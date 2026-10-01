import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_RETRIEVAL_REPLIES, belongsToConversation, classifyWithProvider, embeddingIdentityCompatible, retrieveFromStoredChunks, runWithQuotaGate, summarizeQuestionDistribution } from '../lib/mvp-policy.js';

test('classification uses injected provider metadata and failure paths explicitly', async () => {
  assert.deepEqual(
    await classifyWithProvider(async()=>({text:'pemahaman',degraded:false,provenance:'model'})),
    {category:'pemahaman',provenance:'model'}
  );
  assert.deepEqual(
    await classifyWithProvider(async()=>({text:'pemahaman karena',degraded:false,provenance:'model'})),
    {category:'unclassified',provenance:'malformed'}
  );
  assert.deepEqual(
    await classifyWithProvider(async()=>({text:'hafalan',degraded:true,provenance:'demo'})),
    {category:'unclassified',provenance:'demo'}
  );
  assert.deepEqual(
    await classifyWithProvider(async()=>({text:'',degraded:true,provenance:'unavailable'})),
    {category:'unclassified',provenance:'unavailable'}
  );
  assert.deepEqual(
    await classifyWithProvider(async()=>{throw new Error('provider down');}),
    {category:'unclassified',provenance:'error'}
  );
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
  assert.equal(embeddingIdentityCompatible(q,{...q,model:'other-model'}),false);
  assert.equal(embeddingIdentityCompatible(q,{...q,provider:'demo'}),false);
});

test('retrieval distinguishes empty, irrelevant, provider error, and incompatible embeddings with fake providers', async () => {
  const common={sessionId:'s1',chunkText:'Fotosintesis membutuhkan cahaya.',embeddingJson:'[1,0]',chunkIndex:0,embeddingProvider:'fake',embeddingModel:'embed-v1',embeddingDimensions:2};
  const rankNone=()=>[];
  const rankOne=(_q,chunks)=>[{...chunks[0],score:.9}];
  const embed=async()=>({values:[1,0],provider:'fake',model:'embed-v1',dimensions:2,provenance:'model'});

  assert.equal((await retrieveFromStoredChunks({dbChunks:[],query:'q',embedQuery:embed,rankChunks:rankNone})).status,'empty_material');
  assert.equal((await retrieveFromStoredChunks({dbChunks:[common],query:'q',embedQuery:embed,rankChunks:rankNone})).status,'irrelevant');
  assert.equal((await retrieveFromStoredChunks({dbChunks:[common],query:'q',embedQuery:async()=>{throw new Error('down');},rankChunks:rankNone})).status,'provider_error');
  assert.equal((await retrieveFromStoredChunks({dbChunks:[common],query:'q',embedQuery:async()=>({...await embed(),model:'embed-v2'}),rankChunks:rankNone})).status,'incompatible_embeddings');
  assert.equal((await retrieveFromStoredChunks({dbChunks:[common],query:'q',embedQuery:embed,rankChunks:rankOne})).status,'ok');
});

test('exhausted quota prevents injected provider work', async () => {
  let calls=0;
  const blocked=await runWithQuotaGate(20,20,async()=>{calls+=1; return 'called';});
  assert.equal(blocked.allowed,false);
  assert.equal(calls,0);
  const allowed=await runWithQuotaGate(19,20,async()=>{calls+=1; return 'called';});
  assert.equal(allowed.allowed,true);
  assert.equal(calls,1);
});

test('conversation isolation policy remains intact', () => {
  assert.equal(belongsToConversation({sessionId:'s2',studentId:'a',roomCode:null},{sessionId:'s1',studentId:'a',roomCode:null}),false);
  assert.equal(belongsToConversation({sessionId:'s1',studentId:'b',roomCode:null},{sessionId:'s1',studentId:'a',roomCode:null}),false);
  assert.equal(belongsToConversation({sessionId:'s1',studentId:'b',roomCode:'r2'},{sessionId:'s1',studentId:'a',roomCode:'r1'}),false);
  assert.equal(belongsToConversation({sessionId:'s1',studentId:'b',roomCode:'r1'},{sessionId:'s1',studentId:'a',roomCode:'r1'}),true);
});
