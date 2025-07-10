/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable jsx-a11y/no-static-element-interactions */

import {
  DownOutlined,
  LeftOutlined,
  RightOutlined,
  UpOutlined,
} from '@ant-design/icons';
import {useSize} from 'ahooks';
import classNames from 'classnames';
// import { history } from '@/app/main/compatible';
import {includes} from 'lodash';
import {useReactive} from 'onchain-utility/hooks';
import {useEffect, useRef} from 'react';

import Styles from './index.module.less';

export interface ScrollBarAssembly {
  loading?: boolean;
  style?: React.CSSProperties; //样式
  direction?: boolean; //默认左右，传值true上下
  className?: string; //额外的样式
  children?: React.ReactNode;
}

const ScrollBarAssembly: React.FC<ScrollBarAssembly> = (props) => {
  const rollRef = useRef<HTMLDivElement>(null);

  const size = useSize(rollRef);

  const data = useReactive({
    clientHeight: 0,
    clientWidth: 0,
    scrollHeight: 0,

    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 0,
  });

  useEffect(() => {
    const resizeUpdate = () => {
      if (props.direction) {
        data.scrollTop = rollRef.current?.scrollTop || 0;
        data.clientHeight = rollRef.current?.clientHeight || 0;
        data.scrollHeight = rollRef.current?.scrollHeight || 0;
      } else {
        data.scrollLeft = rollRef.current?.scrollLeft || 0;
        data.clientWidth = rollRef.current?.clientWidth || 0;
        data.scrollWidth = rollRef.current?.scrollWidth || 0;
      }
    };
    resizeUpdate();
    window.addEventListener('resize', resizeUpdate);
    return () => {
      window.removeEventListener('resize', resizeUpdate);
    };
  }, [size]);
  return (
    <div
      className={`${Styles.scrollBarAssembly} ${props.className}`}
      ref={rollRef}
      style={{...props.style}}
      onScroll={(e) => {
        const target = e.target as HTMLDivElement;
        if (props.direction) {
          data.scrollTop = target.scrollTop;
          data.clientHeight = target.clientHeight;
          data.scrollHeight = target.scrollHeight;
        } else {
          data.scrollLeft = target.scrollLeft;
          data.clientWidth = target.clientWidth;
          data.scrollWidth = target.scrollWidth;
        }
      }}
      onWheel={(e) => {
        const target = e.target as HTMLDivElement;
        if (
          includes(target.className, 'frontend-select-dropdown') ||
          includes(target.className, 'frontend-select-item') ||
          includes(target.className, 'frontend-select-item-option-content')
        ) {
          return;
        }
        if (props.direction) {
          e.currentTarget.scrollTop += e.deltaY;
        } else {
          e.currentTarget.scrollLeft += e.deltaY;
        }
      }}>
      {!props.loading &&
        (props.direction ? data.scrollTop !== 0 : data.scrollLeft !== 0) && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            className={classNames(Styles.columnBox, {
              [Styles.buttonChangeTop]: props.direction,
              [Styles.buttonChange]: !props.direction,
            })}
            onClick={(e) => {
              e.stopPropagation();
              if (props.direction) {
                rollRef.current?.scrollTo({
                  behavior: 'smooth',
                  top: data.scrollTop - data.clientHeight,
                });
              } else {
                rollRef.current?.scrollTo({
                  behavior: 'smooth',
                  left: data.scrollLeft - data.clientWidth,
                });
              }
            }}>
            {props.direction ? (
              <UpOutlined className={Styles.iconBox} />
            ) : (
              <LeftOutlined className={Styles.iconBox} />
            )}
          </div>
        )}
      {props.children}
      {!props.loading &&
        (props.direction
          ? data.clientHeight + data.scrollTop + 1 < data.scrollHeight
          : data.clientWidth + data.scrollLeft + 1 < data.scrollWidth) && (
          <div
            className={classNames(Styles.columnBox, {
              [Styles.buttonChangeTop]: props.direction,
              [Styles.topButton]: props.direction,
              [Styles.buttonChange]: !props.direction,
              [Styles.rightButton]: !props.direction,
            })}
            onClick={(e) => {
              e.stopPropagation();
              if (props.direction) {
                rollRef.current?.scrollTo({
                  behavior: 'smooth',
                  top: data.scrollTop + data.clientHeight,
                });
              } else {
                rollRef.current?.scrollTo({
                  behavior: 'smooth',
                  left: data.scrollLeft + data.clientWidth,
                });
              }
            }}>
            {props.direction ? (
              <DownOutlined className={Styles.iconBox} />
            ) : (
              <RightOutlined className={Styles.iconBox} />
            )}
          </div>
        )}
    </div>
  );
};
export default ScrollBarAssembly;
