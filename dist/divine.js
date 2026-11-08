export function canShowHelp(phase, modalHidden) {
  return modalHidden && phase !== 'finisher';
}

export function disposeDivineStrike(strike) {
  if (!strike) return null;
  strike.group.parent?.remove(strike.group);
  strike.light.parent?.remove(strike.light);
  strike.temporaryGeometries.forEach(geometry => geometry.dispose());
  strike.temporaryMaterials.forEach(material => material.dispose());
  return null;
}
