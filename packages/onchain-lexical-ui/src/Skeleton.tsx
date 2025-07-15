/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import Styles from './Skeleton.module.less';

interface SkeletonProps extends BaseComponentProps {
  type: 'avatar' | 'block' | 'text' | 'button' | 'rect' | 'title';
}

export default function Skeleton({
  className,
  style,
  type,
}: SkeletonProps): JSX.Element {
  return (
    <div className={Styles.skeleton}>
      <div
        data-type={type}
        className={`${className ?? ''} ${Styles.skeleton} animated`}
        style={style}
      />
    </div>
  );
}
