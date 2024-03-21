import * as React from 'react';

import logo from './../logo.svg';
import githubWhite from './../github-mark-white.svg';
import { S } from './LayoutStyling';
import styled from '@emotion/styled';

interface WorkspaceProps {

    buttons?: any;
}

export const Workspace: React.FunctionComponent<React.PropsWithChildren<WorkspaceProps>> = ({ buttons, children }) => {

    return (
        <S.WorkspaceContainer>
            <S.Toolbar>
                <img src={logo} alt="Midispatcher Logo" width={30} />
                {buttons}
                <S.WorkspaceTitle>{"MIDISPATCHER"}</S.WorkspaceTitle>
                <S.GitHubLink target="_blank" href="https://github.com/msarilar/midispatcher">
                    <S.GitHub src={githubWhite}/>
                </S.GitHubLink>
            </S.Toolbar>
            <S.Content>{children}</S.Content>
        </S.WorkspaceContainer>
    );
};

export const WorkspaceButton = styled.button<{ toggled?: boolean }>`
    background: ${(p) => p.toggled === true ? "rgb(0, 192, 255)" : "rgb(60, 60, 60)"};
    font-size: 14px;
    padding: 5px 10px;
    border: solid;
    border-width: 1px;
    border-color: rgb(60, 60, 60);
    color: white;
    outline: none;
    cursor: pointer;
    white-space:nowrap;
    margin: 2px;
    border-radius: 5px;
    &:hover {

        background: rgb(0, 192, 255);
        border-color: white;
    };
    &:active {

        background: rgb(122, 192, 255);
        border-color: rgb(150, 150, 150);
    };
`;
