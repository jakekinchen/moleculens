import assert from 'node:assert';
import { fetchMoleculeData, MoleculeData } from './pubchem';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log('--- Running PubChemService Tests (Direct Node Execution) ---');

  // Test 1: Water
  let testName = 'water';
  try {
    console.log('\n[TEST SUITE] Fetch Water');
    console.log(`[TEST] Running test for "${testName}"...`);
    await delay(3000); 

    const moleculeData = await fetchMoleculeData(testName);
    assert.ok(moleculeData, `Test "${testName}" FAILED: moleculeData is null`);
    console.log(`[TEST] Received data for ${testName}:`, { 
      cid: moleculeData.cid, 
      name: moleculeData.name, 
      formula: moleculeData.formula, 
      sdfLength: moleculeData.sdf?.length, 
      pdbLength: moleculeData.pdb_data?.length 
    });
    
    assert.strictEqual(moleculeData.name, testName, `Name should be ${testName}`);
    assert.strictEqual(moleculeData.cid, 962, `CID for ${testName} should be 962`);
    assert.strictEqual(moleculeData.formula, 'H2O', `Formula for ${testName} should be H2O`);
    assert.ok(moleculeData.sdf && moleculeData.sdf.length > 0, 'SDF data should be present');
    assert.ok(moleculeData.pdb_data && moleculeData.pdb_data.length > 0, 'PDB data for water should be present and not empty');
    assert.ok(moleculeData.pdb_data.includes('ATOM'), 'PDB data for water should contain ATOM records');
    console.log(`[TEST SUITE] Fetch Water PASSED`);
  } catch (error) {
    console.error(`[TEST SUITE] Fetch Water FAILED (Query: "${testName}"):`, error);
  }

  // Test 2: Aspirin
  testName = 'aspirin';
  try {
    console.log('\n[TEST SUITE] Fetch Aspirin');
    console.log(`[TEST] Running test for "${testName}"...`);
    await delay(500); 
    const moleculeData = await fetchMoleculeData(testName);
    assert.ok(moleculeData, `Test "${testName}" FAILED: moleculeData is null`);
    console.log(`[TEST] Received data for ${testName}:`, { 
      cid: moleculeData.cid, 
      name: moleculeData.name, 
      formula: moleculeData.formula, 
      sdfLength: moleculeData.sdf?.length, 
      pdbLength: moleculeData.pdb_data?.length 
    });
    
    assert.strictEqual(moleculeData.name, testName, `Name should be ${testName}`);
    assert.strictEqual(moleculeData.cid, 2244, `CID for ${testName} should be 2244`);
    assert.strictEqual(moleculeData.formula, 'C9H8O4', `Formula for ${testName} should be C9H8O4`);
    assert.ok(moleculeData.sdf && moleculeData.sdf.length > 0, `SDF data for ${testName} should be present`);
    assert.ok(moleculeData.pdb_data && moleculeData.pdb_data.length > 0, `PDB data for aspirin should be present and not empty`);
    assert.ok(moleculeData.pdb_data.includes('ATOM'), `PDB data for aspirin should contain ATOM records`);
    console.log(`[TEST SUITE] Fetch Aspirin PASSED`);
  } catch (error) {
    console.error(`[TEST SUITE] Fetch Aspirin FAILED (Query: "${testName}"):`, error);
  }

  // Test 3: Invalid Molecule Name
  const invalidTestName = 'invalidmolecule123xyz';
  try {
    console.log('\n[TEST SUITE] Test Invalid Molecule Name');
    console.log(`[TEST] Running test for "${invalidTestName}"...`);
    await delay(500);
    await fetchMoleculeData(invalidTestName);
    console.error(`[TEST SUITE] Invalid molecule test FAILED - should have thrown error`);
  } catch (error) {
    console.log(`[TEST SUITE] Invalid molecule test PASSED - correctly threw error`);
  }

  // Test 4: API Error Handling
  testName = 'malformed_sdf_test';
  try {
    console.log('\n[TEST SUITE] Test API Error Handling');
    console.log(`[TEST] Running test for "${testName}"...`);
    await delay(500);
    const moleculeData = await fetchMoleculeData('water');
    // Corrupt the SDF data to test error handling
    moleculeData.sdf = 'Invalid SDF Data';
    assert.ok(moleculeData.pdb_data === '', 'PDB data should be empty for invalid SDF');
    console.log(`[TEST SUITE] API Error Handling test PASSED`);
  } catch (error) {
    console.error(`[TEST SUITE] API Error Handling test FAILED:`, error);
  }
}

runTests().catch(console.error);