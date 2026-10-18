// Nodevision/ApplicationSystem/Sessions/BuiltIn/TemplatePopulator.NodevisionSession.js
// This Session fills named document placeholders with images using the shared TemplateSystem.
// @title Template Populator
// @description Populate image placeholders and save a new presentation.
run("templatePopulator.open");
wait("session.templatePopulator.finished");
quit();
