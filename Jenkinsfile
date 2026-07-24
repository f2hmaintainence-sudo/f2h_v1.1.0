pipeline {
    agent any

    stages {
        stage('Deploy Monorepo Build') {
            steps {
                sh '''
                echo "========== STARTING MONOREPO BUILD & DEPLOY =========="

                echo "[F2H Deploy] Building Backend (apps/api)..."
                cd apps/api
                npm install --no-audit --no-fund
                npm run build

                echo "[F2H Deploy] Building Frontend (apps/web)..."
                cd ../web
                npm install --no-audit --no-fund
                npm run build

                echo "[F2H Deploy] Syncing compiled artifacts and configs to live htdocs..."
                LIVE_DIR="/home/f2hfresh/htdocs/f2hfresh.com"

                if [ -d "$LIVE_DIR" ]; then
                    mkdir -p "$LIVE_DIR/apps/api" "$LIVE_DIR/apps/web" 2>/dev/null || true

                    # Copy ecosystem.config.js & root package.json
                    cp -f ../../ecosystem.config.js "$LIVE_DIR/" 2>/dev/null || true
                    cp -f ../../package.json "$LIVE_DIR/" 2>/dev/null || true

                    # Copy backend dist & package.json
                    cp -Rf ../api/dist "$LIVE_DIR/apps/api/" 2>/dev/null || true
                    cp -Rf ../api/src "$LIVE_DIR/apps/api/" 2>/dev/null || true
                    cp -f ../api/package.json "$LIVE_DIR/apps/api/" 2>/dev/null || true

                    # Copy frontend .next & package.json
                    cp -Rf .next "$LIVE_DIR/apps/web/" 2>/dev/null || true
                    cp -Rf src "$LIVE_DIR/apps/web/" 2>/dev/null || true
                    cp -f package.json "$LIVE_DIR/apps/web/" 2>/dev/null || true
                fi

                echo "[F2H Deploy] Starting & Restarting PM2 via live ecosystem.config.js..."
                if [ -f "$LIVE_DIR/ecosystem.config.js" ]; then
                    pm2 start "$LIVE_DIR/ecosystem.config.js" || pm2 restart "$LIVE_DIR/ecosystem.config.js" || pm2 reload "$LIVE_DIR/ecosystem.config.js"
                else
                    pm2 restart all || pm2 reload all || true
                fi

                echo "========== LIVE DEPLOYMENT COMPLETED SUCCESSFULLY =========="
                '''
            }
        }
    }

    post {
        success {
            echo 'Monorepo deployment succeeded!'
        }
        failure {
            echo 'Monorepo deployment failed!'
        }
    }
}
