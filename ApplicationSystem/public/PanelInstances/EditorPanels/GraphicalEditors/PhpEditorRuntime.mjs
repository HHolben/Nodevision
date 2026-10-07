// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorRuntime.mjs
// This module schedules PHP device polling, logic evaluation, logging and dashboard refreshes.
import { readGamepadValues, DEVICE_DRIVERS } from './PhpEditorDevices.mjs';
import { evaluateLogicBlock } from './PhpEditorState.mjs';
import { appendLogIfChanged } from './PhpEditorLogging.mjs';
import { drawWave } from './PhpEditorDashboard.mjs';


export function startPhpEditorRuntime(state, widgetRefs, runtimePanelState, renderPreview, status) {
  let rafId = 0;
  function tick() {
    const nowMs = performance.now();
    if (state.runtimeEnabled) {
      // Poll gamepad-backed devices.
      const gp = readGamepadValues();
      const runtimeContext = { gamepad: gp };
      state.deviceManager.connected.forEach((device) => {
        DEVICE_DRIVERS[device.protocol]?.poll?.(device, runtimeContext);
      });

      const logicResults = {};
      state.logic.blocks.forEach((block) => {
        logicResults[block.type] = evaluateLogicBlock(block, state, nowMs);
      });
      appendLogIfChanged(state, logicResults);

      // Update widgets.
      widgetRefs.forEach((ref) => {
        const widget = ref.widget;
        let value = 0;
        if (widget.source === "gamepad.axis0") {
          const gpDevice = state.deviceManager.connected.find((d) => d.protocol === "gamepad-api");
          value = Number(gpDevice?.values?.axes?.[0] || 0);
        } else if (widget.source === "gamepad.triggerL") {
          const gpDevice = state.deviceManager.connected.find((d) => d.protocol === "gamepad-api");
          value = Number(gpDevice?.values?.triggerL || 0);
        } else if (widget.source === "sensor.temperature") {
          const sensor = state.deviceManager.connected.find((d) => d.name === "temperature") || state.deviceManager.connected.find((d) => d.type === "sensor");
          value = Number(sensor?.values?.value || 0);
        } else if (widget.source === "logic.AND") {
          value = Boolean(state.logic.blocks.find((b) => b.type === "AND") ? 1 : 0);
        }

        if (widget.type === "oscilloscope" || widget.type === "graph") {
          widget.history.push(Number(value));
          if (widget.history.length > 90) widget.history.shift();
          drawWave(ref.canvas, widget.history, widget.type === "graph" ? "#6fa8ff" : "#39f08c");
        } else if (widget.type === "gauge") {
          const gaugeValue = Math.max(0, Math.min(100, Number(value)));
          ref.meter.value = gaugeValue;
          ref.valueLabel.textContent = `${gaugeValue.toFixed(2)}`;
        } else if (widget.type === "led") {
          ref.led.classList.toggle("on", Boolean(value));
        }
      });

      runtimePanelState.loggingRefresh();
      renderPreview();
      status.textContent = `Runtime update @ ${new Date().toLocaleTimeString()} | Devices: ${state.deviceManager.connected.length} | Logs: ${state.logging.records.length}`;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(rafId);
}

