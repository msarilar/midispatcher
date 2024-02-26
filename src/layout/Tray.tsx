import * as React from 'react';
import styled from '@emotion/styled';
import Tooltip from '@mui/material/Tooltip';

import { LabelMachineFactory, MachineFactory, machineTypeToColor } from '../machines/Machines';

export const Tray: React.FunctionComponent<React.PropsWithChildren> = ({ children }) => {

    const [ open, setOpen ] = React.useState(true);

    const toggleTray = () => {

        setOpen(!open);
    };

    const arrow = open ? "Collapse <<" : ">>";

    return (
        <S.Tray open={open}>
            <S.ExpandButton open={open} onClick={toggleTray}>
                {arrow}
            </S.ExpandButton>
            <br/>
            <S.TrayChildrens open={open}>
                {children}
            </S.TrayChildrens>
        </S.Tray>
    );
};

interface TrayItemWidgetProps {

    machineFactory: MachineFactory;
}

export const TrayItem: React.FunctionComponent<TrayItemWidgetProps> = ({ machineFactory }) => {

    const color = machineTypeToColor(machineFactory.getType());
    const isLabel = machineFactory instanceof LabelMachineFactory;
    return (
        <Tooltip disableFocusListener title={<S.Tooltip>{machineFactory.getTooltip()}</S.Tooltip>} placement="right" arrow>
            <S.TrayItem
                color={color}
                textcolor={isLabel ? "black" : "white"}
                background={isLabel ? color : "transparent"}
                isLabel={isLabel }
                draggable={!isLabel}
                onDragStart={(event) => {

                    event.dataTransfer.setData("machine-name", machineFactory.getName());
                }}
                className="tray-item"
            >
                {machineFactory.getName()}
            </S.TrayItem>
        </Tooltip>
    );
};

namespace S {

    export const ExpandButton = styled.button<{ open: boolean }>`
        background: ${(p) => p.open ? "rgb(50, 100, 50)" : "rgb(60, 192, 60)"};
        max-width: ${(props) => (props.open ? '95px' : '40px')};
        float: right;
        padding: 5px 10px;
        border: solid;
        border-width: 1px;
        white-space:nowrap;
        border-color: rgb(60, 60, 60);
        color: white;
        outline: none;
        cursor: pointer;
        margin: 0 8px 0 0;
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
        opacity: ${(props) => (props.open ? '1' : '0')};
    `;

    export const Tray = styled.div<{ open: boolean }>`
        max-width: ${(props) => (props.open ? '200px' : '50px')};
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
}