pipeline {
    agent any

    stages {
        stage('Deploy Live Monorepo') {
            steps {
                sh '''
                echo "========== STARTING LIVE MONOREPO DEPLOYMENT =========="
                LIVE_DIR="/home/f2hfresh/htdocs/f2hfresh.com"

                if [ -d "$LIVE_DIR" ]; then
                    echo "[F2H Deploy] Navigating to live directory: $LIVE_DIR"
                    cd "$LIVE_DIR"
                    git config --global --add safe.directory "$LIVE_DIR" 2>/dev/null || true
                    
                    echo "[F2H Deploy] Fetching and resetting to latest origin/main..."
                    git fetch origin main
                    git reset --hard origin/main

                    echo "[F2H Deploy] Building Backend (apps/api)..."
                    cd "$LIVE_DIR/apps/api"
                    npm install --no-audit --no-fund
                    npm run build

                    echo "[F2H Deploy] Building Frontend (apps/web)..."
                    cd "$LIVE_DIR/apps/web"
                    npm install --no-audit --no-fund
                    npm run build

                    echo "[F2H Deploy] Reloading PM2 processes using ecosystem.config.js..."
                    cd "$LIVE_DIR"
                    pm2 restart ecosystem.config.js || pm2 restart all
                else
                    echo "[F2H Deploy] Workspace Fallback Build..."
                    cd apps/api && npm install --no-audit --no-fund && npm run build
                    cd ../web && npm install --no-audit --no-fund && npm run build
                    pm2 restart all || true
                fi

                echo "========== LIVE DEPLOYMENT COMPLETED SUCCESSFULLY =========="
                '''
            }
        }
    }

    post {
        success {
            echo 'Monorepo build and deploy succeeded!'
        }
        failure {
            echo 'Monorepo deployment failed!'
        }
    }
}
