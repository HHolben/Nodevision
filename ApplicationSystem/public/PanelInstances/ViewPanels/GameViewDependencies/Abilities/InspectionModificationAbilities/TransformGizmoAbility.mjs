// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/TransformGizmoAbility.mjs
// This file composes Game View transform gizmo abilities. It installs shared visual helpers, translation handles, and rotation handles as separate modules so each transform behavior remains small and readable.

import { installRotateGizmoAbility } from "./RotateGizmoAbility.mjs";
import { installTransformGizmoVisualAbility } from "./TransformGizmoVisualAbility.mjs";
import { installTranslateGizmoAbility } from "./TranslateGizmoAbility.mjs";

export function installTransformGizmoAbility(ctx) {
  installTransformGizmoVisualAbility(ctx);
  installTranslateGizmoAbility(ctx);
  installRotateGizmoAbility(ctx);
}
