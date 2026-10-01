import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_RETRIEVAL_REPLIES, belongsToConversation, embeddingIdentityCompatible, hasQuota, resolveClassification, summarizeQuestionDistribution } from '../lib/mvp-policy.js';

test('valid classification', () => assert.deepEqual(resolveClassification({text:'pemahaman',degraded:false,provenance:'model'}), {category:'pemahaman',provenance:'model'}));
test('malformed/degraded/error classifications are explicit', () => {
  assert.deepEqual(resolveClassification({text:'pemahaman karena',degraded:false,provenance:'model'}), {category:'unclassified',provenance:'malformed'});
  assert.deepEqual(resolveClassification({text:'hafalan',degraded:true,provenance:'demo'}), {category:'unclassified',provenance:'degraded'});
  assert.deepEqual(resolveClassification(undefined,true), {category:'unclassified',provenance:'error'});
});
test('unknown is excluded from valid denominator including all-unknown', () => {
  const mixed=summarizeQuestionDistribution([{level:'hafalan',classificationProvenance:'model',count:1},{level:'analisis',classificationProvenance:'model',count:1},{level:'hafalan',classificationProvenance:null,count:8}]);
  assert.equal(mixed.validClassified,2); assert.equal(mixed.unclassified,8); assert.equal(mixed.percentages.hafalan,.5);
  const unknown=summarizeQuestionDistribution([{level:'unclassified',classificationProvenance:'error',count:3}]);
  assert.equal(unknown.validClassified,0); assert.deepEqual(unknown.percentages,{hafalan:0,pemahaman:0,analisis:0});
});
test('empty material and irrelevant context are distinct deterministic replies', () => {
  assert.notEqual(FIXED_RETRIEVAL_REPLIES.empty_material,FIXED_RETRIEVAL_REPLIES.irrelevant);
});
test('embedding identity requires provider, model, and dimensions', () => {
  const q={provider:'gemini',model:'gemini-embedding-001',dimensions:3072};
  assert.equal(embeddingIdentityCompatible(q,{...q}),true);
  assert.equal(embeddingIdentityCompatible(q,{...q,dimensions:64}),false);
});
test('quota and conversation isolation policies', () => {
  assert.equal(hasQuota(20,20),false);
  assert.equal(belongsToConversation({sessionId:'s2',studentId:'a',roomCode:null},{sessionId:'s1',studentId:'a',roomCode:null}),false);
  assert.equal(belongsToConversation({sessionId:'s1',studentId:'b',roomCode:null},{sessionId:'s1',studentId:'a',roomCode:null}),false);
});
