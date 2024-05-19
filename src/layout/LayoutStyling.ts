import styled from "@emotion/styled";
import { css, keyframes } from "@emotion/react";
import grid from "../grid.svg";

export namespace S {

    export const Container = styled.div<{ background: string; }>`
        height: 100%;
        background-color: ${(p) => p.background };
        background-size: 50px 50px;
        background-position: top 10px right 10px;
        display: flex;

        > * {

            height: 100%;
            min-height: 100%;
            width: 100%;
        }

        --offset-x: 0px;
        --offset-y: 0px;
        --grid-size: 25px;

        background-position-x: var(--offset-x);
        background-position-y: var(--offset-y);

        background-size: calc(var(--grid-size) * 3)
            calc(var(--grid-size) * 3);

        background-image: url('${grid}');
    `;

    export const Expand = css`
        html,
        body,
        #root {

            height: 100%;
        }
    `;

    export const Keyframes = keyframes`
        from {

            stroke-dashoffset: 24;
        }
        to {

            stroke-dashoffset: 0;
        }
    `;

    const selected = css`
        stroke-dasharray: 10, 2;
        animation: ${Keyframes} 1s linear infinite;
    `;

    const sending = css`
        stroke-dasharray: 10, 1;
        stroke: lime;
        animation: ${Keyframes} 0.5s linear infinite;
    `;

    const InCycleWarningAnimation = keyframes`
        0%, 100% {
            stroke: rgba(255, 80, 80);
        }
        50% {
            stroke: rgba(120, 120, 120);
        }
    `;

    export const MidiLink = styled.path<{ selected: boolean, sending: boolean, inCycle: boolean }>`
        ${(p) => p.selected && selected};
        ${(p) => p.sending && sending};
        fill: none;

        animation: ${(p) => p.inCycle ? InCycleWarningAnimation : "none" };
        animation-duration: 0.5s;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        pointer-events: auto;
    `;

    export const Node = styled.div<{ background: string; selected: boolean; enabled: boolean }>`
        background-color: ${(p) => p.background};
        opacity: ${(p) => p.enabled ? "1" : "0.5"};
        border-radius: 5px;
        font-family: sans-serif;
        color: white;
        overflow: visible;
        font-size: 11px;
        border: solid 2px ${(p) => (p.selected ? "rgb(0,192,255)" : "black")};
        * {

            box-sizing:border-box
        }
    `;

    export const Title = styled.div`
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        white-space: nowrap;
        justify-items: center;
    `;

    export const TitleName = styled.div`
        flex-grow: 1;
        padding: 5px 5px;
    `;

    export const Ports = styled.div`
        display: flex;
        background-image: linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.1));
    `;

    export const PortsContainer = styled.div`
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        &:first-of-type {

            margin-right: 10px;
        }
        &:only-child {

            margin-right: 0px;
        }
    `;

	export const PortLabel = styled.div`
		display: flex;
		margin-top: 1px;
		align-items: center;
	`;

	export const Label = styled.div`
		padding: 0 5px;
		flex-grow: 1;
	`;

	export const Port = styled.div<{ sending: boolean }>`
		width: 15px;
		height: 15px;
		background: ${(p) => p.sending ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.5)" };

		&:hover {
			background: rgb(192, 255, 0);
		}
	`;

    export const ExpandButton = styled.button<{ open: boolean }>`
        background: ${(p) => p.open ? "rgb(50, 100, 50)" : "rgb(60, 192, 60)"};
        width: ${(props) => (props.open ? "100%" : "40px")};
        float: right;
        padding: 5px 10px;
        border: solid;
        border-width: 1px;
        white-space:nowrap;
        border-color: rgb(60, 60, 60);
        color: white;
        outline: none;
        cursor: pointer;
        float: left;
        margin-top: 1px;
        border-radius: 5px;
        transition: all 0.2s ease-in-out;
    `;

    export const Tooltip = styled.h2`
        font-family: Helvetica, Arial;
        text-align: justify;
        color: lightblue;
    `;

    export const TrayChildrens = styled.div<{ open: boolean }>`
        transition: all 0.3s ease-in-out;
        opacity: ${(props) => (props.open ? "1" : "0")};
    `;

    export const Tray = styled.div<{ open: boolean }>`
        max-width: ${(props) => (props.open ? "200px" : "50px")};
        background: rgb(20, 20, 20);
        flex-grow: 0;
        flex-shrink: 0;
        font-size: 14px;
        transition: all 0.2s ease-in-out;
    `;

    export const TrayItem = styled.div<{ color: string,
        background: string,
        textcolor: string,
        isLabel: boolean }>`
        color: ${(p) => p.textcolor};
        font-family: Helvetica, Arial;
        padding: 5px;
        margin: 0px 10px;
        margin-top: ${(p) => p.isLabel ? "15px" : "0px"};
        text-align: ${(p) => p.isLabel ? "center" : "left"};
        background: ${(p) => p.background};
        border: solid 1px ${(p) => p.color};
        border-radius: 5px;
        margin-bottom: 2px;
        cursor: pointer;
        font-weight: ${(p) => p.isLabel ? "bold" : "unset"};
    `;


    export const GitHubLink = styled.a`
        width: 32px;
        height: 32px;
        margin: 0px;
    `;

    export const GitHub = styled.img`
        width: 32px;
        height: 32px;
        opacity: 50%;
        &:hover {
            opacity: 100%;
            transform: rotate(360deg);
            filter: invert(0.5) sepia(1) saturate(5) hue-rotate(175deg);
        };
        transition: all 0.3s ease-in-out;
    `;

    export const Animation = keyframes`
        to {
            background-position: 250% center;
        }
    `;

    export const WorkspaceTitle = styled.h2<{rightPart?: boolean, middlePart?: boolean}>`
        background-image: ${(p) => (p.rightPart || p.middlePart) === true ?
            "linear-gradient(-225deg,#bbbbdd 0%,#a7d6fa 90%,#ffffff 100%);" :
            "linear-gradient(-225deg,#bbbbbb 0%,#bbbbbb 90%,#ffffff 100%);"};
        background-size: auto auto;
        background-clip: border-box;
        background-size: 200% auto;
        font-family: helvetica;
        margin-right: ${(p) => p.rightPart === true ? "5px" : "0px"};
        margin-left: ${(p) => (p.rightPart || p.middlePart) === true ? "0px" : "auto"};
        margin-top:2px;
        color: #fff;
        background-clip: text;
        text-fill-color: transparent;
        -webkit-background-clip: text;
        animation: ${Animation} 10s linear infinite;
        display: inline-block;
        text-transform: uppercase;
        font-variant-caps: ${(p) => p.rightPart === true ? "all-small-caps" : "normal"};
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

    export const WorkspaceContainer = styled.div`
        background: black;
        display: flex;
        flex-direction: column;
        height: 100%;
        border-radius: 5px;
        overflow: hidden;
    `;

    export const Disqus = styled.div<{ visible: boolean }>`
        display: ${(p) => p.visible ? "block" : "none"};
        padding-top: 10px;
        padding-bottom: 10px;
        padding-left: 30px;
        padding-right: 30px;
        overflow: auto;
        height: 50%;
        width: 50%;
        position: absolute;
        bottom: 0;
        right: 0;
        border: 1px;
        border-style: inset;
        border-color: #0096ff;
        background-color: #202020;

        &::-webkit-scrollbar {

            width: 12px;
        }

        &::-webkit-scrollbar-track {

            -webkit-box-shadow: inset 0 0 6px #0096ff;
            border-radius: 0px;
        }

        &::-webkit-scrollbar-thumb {

            border-radius: 0px;
            -webkit-box-shadow: inset 0 0 6px white;
        }
    `;

    export const Body = styled.div`
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        min-height: 100%;
    `;

    export const Header = styled.div`
        display: flex;
        background: rgb(30, 30, 30);
        flex-grow: 0;
        flex-shrink: 0;
        color: white;
        font-family: Helvetica, Arial, sans-serif;
        padding: 10px;
        align-items: center;
    `;

    export const MainContent = styled.div`
        display: flex;
        flex-grow: 1;
    `;

    export const Layer = styled.div`
        position: relative;
        flex-grow: 1;
    `;

    export const ScrollDiv = styled.div`
        max-height: 400px;
        overflow-y: auto;
    `;
}
