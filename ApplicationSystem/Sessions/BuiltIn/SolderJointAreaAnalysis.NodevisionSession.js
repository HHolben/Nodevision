// @title Solder Joint Area Analysis
// @description Measure manually outlined solder joints and voids in original JPEG pixels and generate a portable HTML report.
// @source bundled
run("solderAnalysis.open");
wait("session.solderAnalysis.finished");
quit();
