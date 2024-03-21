import * as React from 'react';
import { Global } from '@emotion/react';
import { S } from './LayoutStyling';

interface CanvasProps {

    color?: string;
    background?: string;
}

export const Canvas: React.FunctionComponent<React.PropsWithChildren<CanvasProps>> = ({ background, color, children }) => {

    return (
        <>
            <Global styles={S.Expand} />
            <S.Container
                background={background || 'rgb(40, 40, 40)'}
                color={color || 'rgba(255,255,255, 0.05)'}
            >
                {children}
            </S.Container>
        </>
    );
};