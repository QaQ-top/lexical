/**
 * 发布脚本。
 *
 * 用法：
 *   node scripts/release.mjs <patch|minor|major> [--dry-run]
 *
 * 流程（每一步都是幂等的，部分失败后可以安全地重跑）：
 *   1. 读取 package.json 的当前版本
 *   2. 从 npm registry 拉取完整的包元数据，列出所有已发布的版本。
 *      跳号检测使用的是这些版本中的最大值，而不是 `latest` dist-tag，
 *      这样预发布版本和被手工改过的 dist-tag 都没法蒙混过关。
 *   3. 确定目标版本：
 *      - 如果 package.json 已经领先于已发布的最高版本，说明是上次
 *        发布失败后的恢复场景，直接复用 package.json 的版本
 *        （此时 bumpType 参数会被忽略）。
 *      - 否则按 patch / minor / major 递增。
 *   4. 校验目标版本严格大于所有已发布版本（禁止跳号）。
 *   5. 把新版本写入 package.json（暂不提交）。
 *   6. 执行生产构建。
 *   7. 发布到 npm。
 *   8. 通过再次读取 registry 校验发布是否真正落地 —— 没有落地就
 *      中止，工作区保持 dirty，方便下次接着重跑。
 *   9. 只有发布校验通过才把 package.json 提交为 `chore(release): vX.Y.Z`，
 *      把 bump 提交和发布标记合并到一次提交。这样发布失败时历史里
 *      不会残留「已写版本但未发布」的脏记录，也不会出现重复提交。
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PKG_PATH = join(ROOT, "package.json");

const bumpType = process.argv[2];
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error(
    "用法: node scripts/release.mjs <patch|minor|major> [--dry-run]"
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

function exec(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function readPkg() {
  return JSON.parse(readFileSync(PKG_PATH, "utf8"));
}

function writePkg(pkg) {
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function compareVersions(a, b) {
  const [a1, a2, a3] = a.split(".").map(Number);
  const [b1, b2, b3] = b.split(".").map(Number);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

// === Registry helpers ===

async function fetchPackageMetadata(pkgName) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function maxPublishedVersion(versions) {
  return versions.reduce(
    (max, v) => (compareVersions(v, max) > 0 ? v : max),
    "0.0.0"
  );
}

// 一次性返回 registry 当前快照：最新标签 + 最高已发布版本
async function getPublishedSnapshot(pkgName) {
  const metadata = await fetchPackageMetadata(pkgName);
  const versions = Object.keys(metadata?.versions ?? {});
  return {
    latestTag: metadata?.["dist-tags"]?.latest ?? null,
    maxPublished: versions.length > 0 ? maxPublishedVersion(versions) : null,
    totalPublished: versions.length,
  };
}

// 等待 registry 看到目标版本。npm registry 走多层 CDN，发布成功后
// 紧跟着的 fetch 经常还看不到新版本（cache 还在旧值），需要带延迟
// 重试若干次。
async function waitForPublishedVersion(
  pkgName,
  targetVersion,
  {
    maxAttempts = 6,
    delayMs = 3000,
  } = {}
) {
  let lastSnapshot = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snapshot = await getPublishedSnapshot(pkgName);
    lastSnapshot = snapshot;
    if (
      snapshot.maxPublished &&
      compareVersions(snapshot.maxPublished, targetVersion) >= 0
    ) {
      return snapshot;
    }
    if (attempt < maxAttempts) {
      console.log(
        `   ⏳ 等待 registry 同步 (${attempt}/${maxAttempts - 1})...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return lastSnapshot;
}

// === 主流程 ===

const pkg = readPkg();
const pkgVersion = pkg.version;

// 从 npm registry 拉取完整的包元数据，取所有已发布版本的集合。
// 这里故意不只看 `latest` dist-tag —— 预发布版本（例如 1.0.0-beta.1）
// 和被手工改过的 dist-tag 都不应该绕过跳号检测。
const { latestTag, maxPublished, totalPublished } = await getPublishedSnapshot(
  pkg.name
);

console.log(`📦 ${pkg.name}`);
console.log(`   package.json 版本:    ${pkgVersion}`);
console.log(`   latest 标签:          ${latestTag ?? "(无)"}`);
console.log(
  `   最高已发布版本:        ${maxPublished ?? "(无)"}（共 ${totalPublished} 个版本）`
);

// 恢复模式：package.json 已经领先于 registry，把 bumpType 参数视为
// 提示性的，直接复用 package.json 的版本，让脚本从上次失败的地方
// 接续。
let newVersion;
let mode;
if (maxPublished && compareVersions(pkgVersion, maxPublished) > 0) {
  mode = "恢复模式";
  newVersion = pkgVersion;
} else {
  mode = bumpType;
  newVersion = bumpVersion(pkgVersion, bumpType);
}
console.log(`   目标版本:             ${newVersion}（${mode}）`);

if (maxPublished && compareVersions(newVersion, maxPublished) <= 0) {
  console.error(
    `\n❌ 检测到跳号：${newVersion} <= ${maxPublished}（最高已发布版本）`
  );
  process.exit(1);
}

// 1. 更新 package.json（暂不提交 —— 发布成功后再一次性提交）
if (pkgVersion !== newVersion) {
  if (dryRun) {
    console.log(
      `\n[dry-run] 将把 package.json 更新到 ${newVersion}（不会写盘）`
    );
  } else {
    pkg.version = newVersion;
    writePkg(pkg);
    console.log(`\n✅ package.json 已更新到 ${newVersion}`);
  }
} else {
  console.log(`\n⏭️  package.json 已经是 ${newVersion}`);
}

// 2. 构建（幂等，重复跑会重新生成 dist/）
// playground 包的实际构建入口是 `build-vercel`：先跑 `build-types`
// 生成 .d.ts bundle，再跑 `build-prod` 做生产构建。
exec("pnpm run build-vercel");

// 3. 发布 + 校验 + 提交
if (dryRun) {
  console.log("\n[dry-run] 将执行 pnpm publish --no-git-checks");
  console.log("[dry-run] 将再次拉取 registry 校验");
  console.log("[dry-run] 将执行 git add package.json && git commit");
} else {
  try {
    // --no-git-checks: 新流程下 working tree 是 dirty 的（新版本
    // 已经写入 package.json 但还没提交），pnpm 默认的 git 检查会
    // 因此拒绝发布。校验交给脚本自己的 registry 快照完成。
    exec("pnpm publish --no-git-checks");
  } catch (err) {
    console.error(`\n❌`, err);
    process.exit(1);
  }
  // 4. 通过重新拉取 registry 校验发布是否真的落地。
  // npm registry 走多层 CDN，发布成功后立刻 fetch 经常还看不到新版本
  // （cache 还没同步），所以带延迟重试几次再判定。
  console.log("\n🔍 正在校验发布结果...");
  const snapshotAfter = await waitForPublishedVersion(pkg.name, newVersion);
  if (
    !snapshotAfter?.maxPublished ||
    compareVersions(snapshotAfter.maxPublished, newVersion) < 0
  ) {
    console.error(
      `\n❌ 发布校验失败：等待 registry 同步超时，registry 中最高版本为 ${
        snapshotAfter?.maxPublished ?? "(无)"
      }，期望至少 ${newVersion}`
    );
    process.exit(1);
  }
  console.log(`\n✅ 校验通过，v${newVersion} 已发布到 npm`);

  // 5. 一次性提交：发布成功才落账，避免历史残留未发布的脏记录
  exec("git add package.json");
  exec(`git commit -m "chore(release): v${newVersion}"`);
}

console.log(`\n🎉 已发布 v${newVersion}`);
