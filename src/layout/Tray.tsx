import * as React from "react";
import Tooltip from "@mui/material/Tooltip";

import { LabelMachineFactory, MachineFactory, machineTypeToColor } from "../machines/Machines";
import { S } from "./LayoutStyling";

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
