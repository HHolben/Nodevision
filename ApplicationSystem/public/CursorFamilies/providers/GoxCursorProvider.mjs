// Nodevision/ApplicationSystem/public/CursorFamilies/providers/GoxCursorProvider.mjs
// Supplies voxel tools to the existing contextual Cursor menu.
import { buildTools } from '/Voxels/VoxelBuildPointer.mjs';
export function createCursorFamilyProvider(){return{id:'gox-cursor-tools',withContext(context){return{...this,context};},getTools(){return [...buildTools,'extrude','extrude-x','extrude-y','extrude-z'].map(id=>({id,label:id,glyph:id.toUpperCase()}));},getActiveToolId(){return this.context?.source?.getSelectedTool?.()||'orbit';},getFallbackToolId(){return'orbit';},activateTool(id){this.context?.source?.activateTool?.(id);return true;}};}
