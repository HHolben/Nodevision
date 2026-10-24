// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Budgets.mjs
// This module declares independent access, decode, snapshot, projection, and rendering budgets for version-two geographic terrain.
export const GEO_BUDGETS=Object.freeze({sourceBytes:8*1024**3,transferBytes:64*1024**2,requests:4096,samples:1048576,
  blockBytes:64*1024**2,peakBytes:256*1024**2,snapshotBytes:24*1024**2,extentMeters:20000,worldMeters:1000000,
  frameMs:4,residentChunks:256,residentBytes:128*1024**2});
