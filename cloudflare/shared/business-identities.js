export const businessRelationships = Object.freeze({
 trading_name:'Trading name',website_operator:'Website operated by the licence holder',
 operating_organisation:'Operating organisation',subsidiary:'Subsidiary relationship',group_relationship:'Group relationship',
});
export function identityRegisterFresh(meta,now=Date.now()){
 const checked=Date.parse(meta?.checked_at),source=Date.parse(meta?.source_date);
 return !!meta?.snapshot&&!meta.refresh_error&&Number.isFinite(checked)&&Number.isFinite(source)&&checked<=now+300000&&checked>now-2*86400000&&source<=now+300000&&source>now-7*86400000;
}
