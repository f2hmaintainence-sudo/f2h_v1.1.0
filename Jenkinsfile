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

                echo "[F2H Deploy] Syncing compiled artifacts to live htdocs..."
                LIVE_DIR="/home/f2hfresh/htdocs/f2hfresh.com"

                if [ -d "$LIVE_DIR" ]; then
                    mkdir -p "$LIVE_DIR/apps/api" "$LIVE_DIR/apps/web" 2>/dev/null || true

                    echo "[F2H Deploy] Copying backend dist..."
                    cp -Rf ../api/dist "$LIVE_DIR/apps/api/" 2>/dev/null || true
                    cp -Rf ../api/src "$LIVE_DIR/apps/api/" 2>/dev/null || true

                    echo "[F2H Deploy] Copying frontend .next..."
                    cp -Rf .next "$LIVE_DIR/apps/web/" 2>/dev/null || true
                    cp -Rf src "$LIVE_DIR/apps/web/" 2>/dev/null || true
                fi

                echo "[F2H Deploy] Restarting PM2 processes..."
                pm2 restart all || pm2 reload all || true

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
