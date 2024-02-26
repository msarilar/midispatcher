import * as React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

import logo from './../logo.svg';
import githubWhite from './../github-mark-white.svg';

interface WorkspaceProps {

    buttons?: any;
}

export const Workspace: React.FunctionComponent<React.PropsWithChildren<WorkspaceProps>> = ({ buttons, children }) => {

    return (
        <S.Container>
            <S.Toolbar>
                <img src={logo} alt="Midispatcher Logo" width={30} />
                {buttons}
                <S.Title>{"MIDISPATCHER"}</S.Title>
                <S.GitHubLink target="_blank" href="https://github.com/msarilar/midispatcher">
                    <S.GitHub src={githubWhite}/>
                </S.GitHubLink>
            </S.Toolbar>
            <S.Content>{children}</S.Content>
        </S.Container>
    );
};

namespace S {

    export const GitHubLink = styled.a`
        width: 32px;
        height: 32px;
        margin: 0px;
    `

    export const GitHub = styled.img`
        width: 32px;
        height: 32px;
        opacity: 50%;
        &:hover {
            opacity: 100%;
            transform: rotate(360deg);
        };
        transition: all 0.2s ease-in-out;
    `

    export const Animation = keyframes`
        to {
            background-position: 500% center;
        }
    `;

    export const Title = styled.h2`
        background-image: linear-gradient(
            -225deg,
            #bbbbbb 0%,
            #bbbbbb 90%,
            #ffffff 100%
        );
        background-size: auto auto;
        background-clip: border-box;
        background-size: 200% auto;
        margin-left: auto;
        font-family: helvetica;
        margin-right:5px;
        margin-top:2px;
        color: #fff;
        background-clip: text;
        text-fill-color: transparent;
        -webkit-background-clip: text;
        animation: ${Animation} 10s linear infinite;
        display: inline-block;
        text-transform: uppercase;
    `;

    export const Toolbar = styled.div`
        padding: 5px;
        display: flex;
        flex-shrink: 0;
    `;

    export const Content = styled.div`
        flex-grow: 1;
        height: 100%;
    `;

    export const Container = styled.div`
        background: black;
        display: flex;
        flex-direction: column;
        height: 100%;
        border-radius: 5px;
        overflow: hidden;
    `;
}

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