export function getLevelInfo(currentValue, stages) {
  // stages가 없거나 빈 배열인 경우 기본값 반환
  if (!stages || !Array.isArray(stages) || stages.length === 0) {
    return {
      currentStage: 1,
      result: '시작하기',
      currentTarget: 0,
      progress: 0,
      property: '',
    };
  }

  let currentStage = 1;

  // Find current stage
  for (let i = 0; i < stages.length; i++) {
    if (stages[i] && currentValue >= stages[i].target) {
      currentStage = i + 1;
    }
  }

  // clamp to max stage
  if (currentStage > stages.length) {
    currentStage = stages.length;
  }

  const currentStageData = stages[currentStage - 1];
  
  // currentStageData가 없는 경우 기본값 반환
  if (!currentStageData) {
    return {
      currentStage: 1,
      result: '시작하기',
      currentTarget: 0,
      progress: 0,
      property: '',
    };
  }

  const prevTarget = currentStage > 1 && stages[currentStage - 2] 
    ? stages[currentStage - 2].target 
    : 0;
  const nextTarget = currentStageData.target || 0;

  // progress %
  const progress = nextTarget > prevTarget
    ? ((currentValue - prevTarget) / (nextTarget - prevTarget)) * 100
    : 0;

  return {
    currentStage,
    result: currentStageData.result || '시작하기',
    currentTarget: nextTarget,
    progress: Math.max(0, Math.min(100, progress)), // clamp 0–100
    property: currentStageData.property || '',
  };
}
