export function initialCollectionIsProgressing(source, now=Date.now()) {
  const progress=source.collection;
  const checked=now-Date.parse(progress?.checked_at),started=now-Date.parse(progress?.started_at);
  return !source.last_success && !source.error && progress?.state==='collecting' &&
    Number.isInteger(progress.ready) && progress.ready>0 && Number.isInteger(progress.total) && progress.ready<progress.total &&
    checked>=-300000 && checked<8*3600000 && started>=-300000 && started<4*86400000;
}
