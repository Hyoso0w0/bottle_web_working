export function getLevelInfo(currentValue, stages) {
  let currentStage = 1;

  // Find current stage
  for (let i = 0; i < stages.length; i++) {
    if (currentValue >= stages[i].target) {
      currentStage = i + 1;
    }
  }

  // clamp to max stage
  if (currentStage > stages.length) {
    currentStage = stages.length;
  }

  const currentStageData = stages[currentStage - 1];
  const prevTarget = currentStage > 1 ? stages[currentStage - 2].target : 0;
  const nextTarget = currentStageData.target;

  // progress %
  const progress =
    ((currentValue - prevTarget) / (nextTarget - prevTarget)) * 100;

  return {
    currentStage,
    result: currentStageData.result,
    currentTarget: nextTarget,
    progress: Math.max(0, Math.min(100, progress)), // clamp 0–100
    property: currentStageData.property,
  };
}
