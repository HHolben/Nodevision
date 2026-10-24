# Nodevision/scripts/geographic-large-fixtures.py
# This script uses tifffile to write synthetic tiled sources for window-import and multi-kilometer traversal tests without survey downloads.
import pathlib,sys
import numpy as np
import tifffile
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
n=2048
x=np.arange(n,dtype=np.float32)[None,:]
y=np.arange(n,dtype=np.float32)[:,None]
values=(100+x*.015+y*.01).astype(np.float32)
values[:128,:128]=3000
values[-128:,-128:]=-9999
keys=(1,1,0,3,1024,0,1,1,1025,0,1,1,3072,0,1,32634)
tags=[(33550,'d',3,(10,10,0),False),(33922,'d',6,(0,0,0,666400,4368000,0),False),(34735,'H',len(keys),keys,False),(42113,'s',0,'-9999',False)]
tifffile.imwrite(out/'large-dem.tif',values,tile=(128,128),metadata=None,extratags=tags)
tifffile.imwrite(out/'large-cover.tif',np.where(x+np.zeros((n,1))<n/2,10,20).astype(np.uint8),tile=(128,128),metadata=None,extratags=tags)
# A layout with a strip exceeding the decoder budget must fail before allocation.
large=np.zeros((4097,4097),dtype=np.float32)
tifffile.imwrite(out/'large-strip.tif',large,rowsperstrip=4097,metadata=None,extratags=tags)
print('Synthetic tiled and oversized-strip fixtures written to',out)
