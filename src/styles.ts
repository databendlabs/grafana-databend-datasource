import { css } from '@emotion/css';

export const styles = {
  Common: {
    wrapper: css`
      position: relative;
      width: 100%;
    `,
    expand: css`
      position: absolute;
      top: 2px;
      left: 6px;
      z-index: 100;
      color: gray;
      cursor: pointer;
    `,
    smallBtn: css`
      margin-top: 5px;
      margin-inline: 5px;
    `,
    toolbox: css`
      border: 1px solid rgba(204, 204, 220, 0.15);
      border-top: none;
      padding: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    `,
  },
  QueryEditor: {
    queryType: css`
      justify-content: space-between;
      span {
        display: flex;
      }
    `,
    inlineField: css`
      margin-left: 7px;
    `,
  },
};
