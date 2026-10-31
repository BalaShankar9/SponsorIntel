import test from 'node:test';
import assert from 'node:assert/strict';
import {adminSectionFromHash} from '../shared/admin-navigation.js';
test('owner section bookmarks and old operational email links resolve safely',()=>{
 assert.equal(adminSectionFromHash('#admin-marketing'),'marketing');
 assert.equal(adminSectionFromHash('#admin-quality'),'quality');
 assert.equal(adminSectionFromHash('#operation-alerts'),'operations');
 for(const value of ['', '#admin-delete', '#admin-operations/../sources', '#admin-unknown']) assert.equal(adminSectionFromHash(value),'overview');
});
