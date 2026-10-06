// Nodevision/ApplicationSystem/public/MetaWorld/Materials/MaterialCatalogRows.mjs
// This module provides material catalog rows behavior shared by Nodevision world objects, equations, and voxels.



export const WORLD_OBJECT_MATERIAL_LIBRARY_PATH = "/MetaWorld/Materials";

export const WORLD_OBJECT_MATERIAL_CATALOG_PATH = "/MetaWorld/Materials.csv";

export const DEFAULT_WORLD_OBJECT_MATERIAL_ID = "PhysicsSolid";

export const DEFAULT_WORLD_OBJECT_MATERIAL_FILE = WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/Solids/PhysicsSolid.json";

export const DEFAULT_WORLD_GAS_MATERIAL_ID = "WhiteOxygenatedAir";

export const DEFAULT_WORLD_GAS_MATERIAL_FILE = WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/Gasses/WhiteOxygenatedAir.json";

export const DEFAULT_WORLD_OBJECT_MATERIAL_ROWS = [
  { MaterialName: "Oak Foliage", MaterialJSONfile: "Materials/Solids/OakFoliage.json" },
  { MaterialName: "Oak Bark", MaterialJSONfile: "Materials/Solids/OakBark.json" },
  { MaterialName: "Oak Wood", MaterialJSONfile: "Materials/Solids/OakWood.json" },
  { MaterialName: "Maple Foliage", MaterialJSONfile: "Materials/Solids/MapleFoliage.json" },
  { MaterialName: "Maple Bark", MaterialJSONfile: "Materials/Solids/MapleBark.json" },
  { MaterialName: "Maple Wood", MaterialJSONfile: "Materials/Solids/MapleWood.json" },
  { MaterialName: "Limestone Gravel", MaterialJSONfile: "Materials/Solids/LimestoneGravel.json" },
  { MaterialName: "Pine Foliage", MaterialJSONfile: "Materials/Solids/PineFoliage.json" },
  { MaterialName: "Pine Bark", MaterialJSONfile: "Materials/Solids/PineBark.json" },
  { MaterialName: "Pine Wood", MaterialJSONfile: "Materials/Solids/PineWood.json" },
  { MaterialName: "Physics Solid", MaterialJSONfile: "Materials/Solids/PhysicsSolid.json" },
  { MaterialName: "Physics Frictionless", MaterialJSONfile: "Materials/Solids/PhysicsFrictionless.json" },
  { MaterialName: "Grass", MaterialJSONfile: "Materials/Solids/grass.json" },
  { MaterialName: "Stone", MaterialJSONfile: "Materials/Solids/stone.json" },
  { MaterialName: "Soil", MaterialJSONfile: "Materials/Solids/soil.json" },
  { MaterialName: "Limestone", MaterialJSONfile: "Materials/Solids/limestone.json" },
  { MaterialName: "Sand", MaterialJSONfile: "Materials/Solids/sand.json" },
  { MaterialName: "Snow", MaterialJSONfile: "Materials/Solids/snow.json" },
  { MaterialName: "Lava", MaterialJSONfile: "Materials/Solids/lava.json" },
  { MaterialName: "Gravel", MaterialJSONfile: "Materials/Solids/gravel.json" },
  { MaterialName: "Andesite", MaterialJSONfile: "Materials/Solids/andesite.json" },
  { MaterialName: "Basalt", MaterialJSONfile: "Materials/Solids/basalt.json" },
  { MaterialName: "Claystone", MaterialJSONfile: "Materials/Solids/claystone.json" },
  { MaterialName: "Chalk", MaterialJSONfile: "Materials/Solids/chalk.json" },
  { MaterialName: "Quartzite", MaterialJSONfile: "Materials/Solids/quartzite.json" },
  { MaterialName: "Marble", MaterialJSONfile: "Materials/Solids/marble.json" },
  { MaterialName: "Schist", MaterialJSONfile: "Materials/Solids/schist.json" },
  { MaterialName: "Slate", MaterialJSONfile: "Materials/Solids/slate.json" },
  { MaterialName: "Obsidian", MaterialJSONfile: "Materials/Solids/obsidian.json" },
  { MaterialName: "Pit Foam Block", MaterialJSONfile: "Materials/Solids/PitFoamBlock.json" },
  { MaterialName: "Bouncy Rubber", MaterialJSONfile: "Materials/Solids/BouncyRubber.json" },
  { MaterialName: "Water", MaterialJSONfile: "Materials/Liquids/water.json" },
  { MaterialName: "Lake Water", MaterialJSONfile: "Materials/Liquids/lakewater.json" },
  { MaterialName: "Salt Water", MaterialJSONfile: "Materials/Liquids/saltwater.json" },
  { MaterialName: "Slime", MaterialJSONfile: "Materials/Liquids/slime.json" },
  { MaterialName: "Quicksand", MaterialJSONfile: "Materials/Liquids/quicksand.json" },
  { MaterialName: "Mud", MaterialJSONfile: "Materials/Liquids/mud.json" },
  { MaterialName: "Bog Water", MaterialJSONfile: "Materials/Liquids/bogwater.json" },
  { MaterialName: "Honey", MaterialJSONfile: "Materials/Liquids/honey.json" },
  { MaterialName: "Milk", MaterialJSONfile: "Materials/Liquids/milk.json" },
  { MaterialName: "Tea", MaterialJSONfile: "Materials/Liquids/tea.json" },
  { MaterialName: "Petroleum", MaterialJSONfile: "Materials/Liquids/petroleum.json" },
  { MaterialName: "White Oxygenated Air", MaterialJSONfile: "Materials/Gasses/WhiteOxygenatedAir.json" },
  { MaterialName: "Earth Troposphere", MaterialJSONfile: "Materials/Gasses/EarthTroposphere.json" },
  { MaterialName: "Hydrogen", MaterialJSONfile: "Materials/Gasses/hydrogen.json" },
  { MaterialName: "Helium", MaterialJSONfile: "Materials/Gasses/helium.json" },
  { MaterialName: "Vacuum", MaterialJSONfile: "Materials/Gasses/vacuum.json" },
];

export const CANONICAL_MATERIAL_IDS = new Map([
  ["oakfoliage", "OakFoliage"], ["oak foliage", "OakFoliage"],
  ["oakbark", "OakBark"], ["oak bark", "OakBark"],
  ["oakwood", "OakWood"], ["oak wood", "OakWood"],
  ["maplefoliage", "MapleFoliage"], ["maple foliage", "MapleFoliage"],
  ["maplebark", "MapleBark"], ["maple bark", "MapleBark"],
  ["maplewood", "MapleWood"], ["maple wood", "MapleWood"],
  ["limestonegravel", "LimestoneGravel"], ["limestone gravel", "LimestoneGravel"],
  ["pinewood", "PineWood"], ["pine wood", "PineWood"],
  ["pinebark", "PineBark"], ["pine bark", "PineBark"],
  ["pinefoliage", "PineFoliage"], ["pine foliage", "PineFoliage"],
  ["water", "water"],
  ["physicsfrictionless", "PhysicsFrictionless"],
  ["physics frictionless", "PhysicsFrictionless"],
  ["physicssolid", "PhysicsSolid"],
  ["physics solid", "PhysicsSolid"],
  ["pitfoamblock", "PitFoamBlock"],
  ["pit foam block", "PitFoamBlock"],
  ["bouncyrubber", "BouncyRubber"],
  ["bouncy rubber", "BouncyRubber"],
  ["whiteoxygenatedair", "WhiteOxygenatedAir"],
  ["white oxygenated air", "WhiteOxygenatedAir"],
  ["earthtroposphere", "EarthTroposphere"],
  ["earth troposphere", "EarthTroposphere"],
  ["vacuum", "vacuum"],
  ["lake water", "lakewater"],
  ["salt water", "saltwater"],
  ["bog water", "bogwater"]
]);
