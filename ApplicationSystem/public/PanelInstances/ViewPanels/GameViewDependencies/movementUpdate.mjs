// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file composes browser-side Game View movement from focused ability modules. It installs movement, attack, inspection, craft, construction, command, and interaction abilities into a shared context so the update loop remains transparent and maintainable.

import { createMovementContext } from "./Abilities/movementContext.mjs";
import { installBreakTargetAbility } from "./Abilities/AttackAbilities/BreakTargetAbility.mjs";
import { installVoxelRemovalAbility } from "./Abilities/AttackAbilities/VoxelRemovalAbility.mjs";
import { installTemporalManipulatorAbility } from "./Abilities/CommandAbilities/TemporalManipulatorAbility.mjs";
import { installEditorModeFrameAbility } from "./Abilities/CommandAbilities/EditorModeFrameAbility.mjs";
import { installEditorSelectionCommandAbility } from "./Abilities/CommandAbilities/EditorSelectionCommandAbility.mjs";
import { installFramePreflightAbility } from "./Abilities/CommandAbilities/FramePreflightAbility.mjs";
import { installInputStateAbility } from "./Abilities/CommandAbilities/InputStateAbility.mjs";
import { installInventoryCommandAbility } from "./Abilities/CommandAbilities/InventoryCommandAbility.mjs";
import { createMovementUpdateLoop } from "./Abilities/CommandAbilities/MovementUpdateLoop.mjs";
import { installSelectedItemActionAbility } from "./Abilities/CommandAbilities/SelectedItemActionAbility.mjs";
import { installUseAttackCommandAbility } from "./Abilities/CommandAbilities/UseAttackCommandAbility.mjs";
import { installVoxelDialogUiAbility } from "./Abilities/CraftAbilities/VoxelDialogUiAbility.mjs";
import { installVoxelMaterialConfigAbility } from "./Abilities/CraftAbilities/VoxelMaterialConfigAbility.mjs";
import { installVoxelPlacerDialogAbility } from "./Abilities/CraftAbilities/VoxelPlacerDialogAbility.mjs";
import { installVoxelToolActionsAbility } from "./Abilities/CraftAbilities/VoxelToolActionsAbility.mjs";
import { installAssetPropertyAbility } from "./Abilities/ConstructAbilities/AssetPropertyAbility.mjs";
import { installFunctionMeshAbility } from "./Abilities/ConstructAbilities/FunctionMeshAbility.mjs";
import { installInventoryPlacementAbility } from "./Abilities/ConstructAbilities/InventoryPlacementAbility.mjs";
import { installPlacedMeshFactoryAbility } from "./Abilities/ConstructAbilities/PlacedMeshFactoryAbility.mjs";
import { installPlacedObjectRegistryAbility } from "./Abilities/ConstructAbilities/PlacedObjectRegistryAbility.mjs";
import { installPlacementCollisionAbility } from "./Abilities/ConstructAbilities/PlacementCollisionAbility.mjs";
import { installPlacementGeometryAbility } from "./Abilities/ConstructAbilities/PlacementGeometryAbility.mjs";
import { installVoxelExtrusionAbility } from "./Abilities/ConstructAbilities/VoxelExtrusionAbility.mjs";
import { installVoxelPlacementAbility } from "./Abilities/ConstructAbilities/VoxelPlacementAbility.mjs";
import { installEnvironmentRuntimeAbility } from "./Abilities/InteractAbilities/EnvironmentRuntimeAbility.mjs";
import { installPortalTravelAbility } from "./Abilities/InteractAbilities/PortalTravelAbility.mjs";
import { installRuntimeReferenceAbility } from "./Abilities/InteractAbilities/RuntimeReferenceAbility.mjs";
import { installTriggerActionAbility } from "./Abilities/InteractAbilities/TriggerActionAbility.mjs";
import { installCameraMovementAbility } from "./Abilities/MovementAbilities/CameraMovementAbility.mjs";
import { installBounceMaterialAbility } from "./Abilities/MovementAbilities/BounceMaterialAbility.mjs";
import { installFlyingCarpetAbility } from "./Abilities/MovementAbilities/FlyingCarpetAbility.mjs";
import { installFlyingCarpetRuntimeAbility } from "./Abilities/MovementAbilities/FlyingCarpetRuntimeAbility.mjs";
import { installGravityAbility } from "./Abilities/MovementAbilities/GravityAbility.mjs";
import { installPlayerMovementFrameAbility } from "./Abilities/MovementAbilities/PlayerMovementFrameAbility.mjs";
import { installPlayerRulesAbility } from "./Abilities/MovementAbilities/PlayerRulesAbility.mjs";
import { installTerrainGroundAbility } from "./Abilities/MovementAbilities/TerrainGroundAbility.mjs";
import { installConsoleInspectionAbility } from "./Abilities/InspectionModificationAbilities/ConsoleInspectionAbility.mjs";
import { installInspectionTargetingAbility } from "./Abilities/InspectionModificationAbilities/InspectionTargetingAbility.mjs";
import { installObjectGrabAbility } from "./Abilities/InspectionModificationAbilities/ObjectGrabAbility.mjs";
import { installPickingAbility } from "./Abilities/InspectionModificationAbilities/PickingAbility.mjs";
import { installStlVertexEditingAbility } from "./Abilities/InspectionModificationAbilities/StlVertexEditingAbility.mjs";
import { installStretchGizmoAbility } from "./Abilities/InspectionModificationAbilities/StretchGizmoAbility.mjs";
import { installSvgCameraAbility } from "./Abilities/InspectionModificationAbilities/SvgCameraAbility.mjs";
import { installTapeMeasureAbility } from "./Abilities/InspectionModificationAbilities/TapeMeasureAbility.mjs";
import { installTerrainPaintAbility } from "./Abilities/InspectionModificationAbilities/TerrainPaintAbility.mjs";
import { installTransformGizmoAbility } from "./Abilities/InspectionModificationAbilities/TransformGizmoAbility.mjs";

const ABILITY_INSTALLERS = [
  installPickingAbility,
  installSelectedItemActionAbility,
  installPlayerRulesAbility,
  installRuntimeReferenceAbility,
  installPlacementCollisionAbility,
  installPlacementGeometryAbility,
  installAssetPropertyAbility,
  installFunctionMeshAbility,
  installPlacedObjectRegistryAbility,
  installVoxelMaterialConfigAbility,
  installVoxelDialogUiAbility,
  installVoxelPlacerDialogAbility,
  installFlyingCarpetRuntimeAbility,
  installFlyingCarpetAbility,
  installVoxelPlacementAbility,
  installVoxelRemovalAbility,
  installVoxelExtrusionAbility,
  installBounceMaterialAbility,
  installTerrainGroundAbility,
  installGravityAbility,
  installCameraMovementAbility,
  installEnvironmentRuntimeAbility,
  installInputStateAbility,
  installInventoryCommandAbility,
  installFramePreflightAbility,
  installEditorModeFrameAbility,
  installEditorSelectionCommandAbility,
  installPortalTravelAbility,
  installTriggerActionAbility,
  installStlVertexEditingAbility,
  installInspectionTargetingAbility,
  installConsoleInspectionAbility,
  installSvgCameraAbility,
  installTapeMeasureAbility,
  installTerrainPaintAbility,
  installTemporalManipulatorAbility,
  installUseAttackCommandAbility,
  installBreakTargetAbility,
  installVoxelToolActionsAbility,
  installPlacedMeshFactoryAbility,
  installInventoryPlacementAbility
];

export function createMovementUpdater(dependencies) {
  const ctx = createMovementContext(dependencies);
  ABILITY_INSTALLERS.forEach((installAbility) => installAbility(ctx));
  return createMovementUpdateLoop(ctx);
}
