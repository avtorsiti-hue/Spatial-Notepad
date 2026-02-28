/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactFlowProvider } from '@xyflow/react';
import SpatialCanvas from './components/SpatialCanvas';

/**
 * Основной компонент приложения.
 * Оборачивает холст в ReactFlowProvider для доступа к API React Flow.
 */
export default function App() {
  return (
    <ReactFlowProvider>
      <SpatialCanvas />
    </ReactFlowProvider>
  );
}


