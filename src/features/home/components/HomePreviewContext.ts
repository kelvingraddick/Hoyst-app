import {createContext} from 'react';

/** Read-only native presentation captures supplied only by the debug host. */
export const HomePreviewContext = createContext<
  {captureBottom?: boolean; viewportWidth?: number} | undefined
>(undefined);
