// fileCallbacks.js
export const fileCallbacks = {
  saveFile: () => {
    const filePath = window.currentActiveFilePath;
    if (filePath && typeof window.saveWYSIWYGFile === 'function') {
      window.saveWYSIWYGFile(filePath);
    } else {
      console.error("Cannot save: filePath or saveWYSIWYGFile is missing.");
    }
  },
  viewNodevisionDeployment: () => {
    const activeNode = window.ActiveNode;
    if (activeNode) {
      const deploymentUrl = `http://localhost:3000/Notebook/${activeNode}`;
      window.open(deploymentUrl, "_blank");
    } else {
      alert("No active node specified in the URL.");
    }
  },
  viewPHPdeployment: () => {
    const activeNode = window.ActiveNode;
    if (activeNode) {
      const deploymentUrl = `http://localhost:8000/Notebook/${activeNode}`;
      window.open(deploymentUrl, "_blank");
    } else {
      alert("No active node specified in the URL.");
    }
  }
};
