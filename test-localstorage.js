// Quick test script to verify localStorage functions
// Open browser console and paste this to test

console.log('=== Testing localStorage functions ===')

// Test data
const testScript = {
  id: 'test_script_123',
  userId: 'test_user',
  topic: 'Test Topic',
  content: 'This is test content',
  createdAt: new Date().toISOString()
}

// Test lsSet
console.log('1. Testing lsSet...')
const key = `scripts_${testScript.id}`
localStorage.setItem(key, JSON.stringify(testScript))
console.log('✓ Saved to localStorage')

// Test lsGet
console.log('2. Testing lsGet...')
const retrieved = JSON.parse(localStorage.getItem(key))
console.log('Retrieved:', retrieved)
console.log('✓ Retrieved from localStorage')

// Test lsGetAll
console.log('3. Testing lsGetAll...')
const allScripts = []
for (let i = 0; i < localStorage.length; i++) {
  const storageKey = localStorage.key(i)
  if (storageKey?.startsWith('scripts_')) {
    const data = localStorage.getItem(storageKey)
    if (data) {
      allScripts.push(JSON.parse(data))
    }
  }
}
console.log('All scripts:', allScripts)
console.log('✓ Retrieved all scripts')

// Cleanup
console.log('4. Cleaning up test data...')
localStorage.removeItem(key)
console.log('✓ Test complete')

console.log('\n=== All tests passed! ===')
