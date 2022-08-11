var ignoreWatch = [
    'node_modules',
    'logs',
    'data',
    'dist',
    'conf'
  ]
  module.exports = {
    apps : [
        {
            name: 'execution_bot', 
            script: './execution_bot/index.js', 
            instances: 1, 
            exec_mode: 'cluster', 
            ignore_watch: ignoreWatch,
            merge_logs: true, 
            autorestart: true, 
            watch: false, 
            
            env: {
                'port': '3000',
                'POLL_INTERVAL_MS': 1000,
                'NODE_URL':"",
                'PRIVATE_KEY':'',
                'TRADING_UNIT':1,
                'REDIS_ENDPOINT':'127.0.0.1'
            },
        },
        {
        name: 'liquidation_bot',
        script: './liquidation_bot/index.js',
        instances: 1,
        exec_mode: 'cluster',
        ignore_watch: ignoreWatch,
        merge_logs: true, 
        autorestart: true,
        watch: false,
        //max_memory_restart: '1500M',
        env: {
            'port': '3001',
            'POLL_INTERVAL_MS': 1000,
            'NODE_URL':"",
            'PRIVATE_KEY':'',
            'TRADING_UNIT':1,
            'REDIS_ENDPOINT':'127.0.0.1'
        },
    },
    ]
  };​