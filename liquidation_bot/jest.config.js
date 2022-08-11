module.exports = {
    setupFilesAfterEnv: ['./jest.setup.redis-mock.js', '../execution_bot/jest.setup.redis-mock.js'],
    verbose: true
}