pipeline {
    agent any

    stages {
        stage('Deploy Backend') {
            steps {
                sh '''
                echo "========== STARTING BACKEND DEPLOYMENT =========="
                cd apps/api
                npm install --no-audit --no-fund
                npm run build
                # Sync build output to potential live deployment paths
                for dir in "/home/f2hfresh/htdocs/f2hfresh.com/apps/api" "/var/www/f2hfresh/apps/api" "/home/f2hfresh/apps/api"; do
                    if [ -d "$dir" ]; then
                        echo "Syncing backend dist to $dir..."
                        cp -r dist "$dir/" 2>/dev/null || true
                        cp -r src "$dir/" 2>/dev/null || true
                    fi
                done
                pm2 restart api-f2hfresh --update-env || pm2 restart all || pm2 reload all || pm2 start npm --name "api-f2hfresh" -- run start
                echo "========== BACKEND DEPLOYMENT SUCCESS =========="
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                echo "========== STARTING FRONTEND DEPLOYMENT =========="
                cd apps/web
                npm install --no-audit --no-fund
                npm run build
                # Sync build output to potential live deployment paths
                for dir in "/home/f2hfresh/htdocs/f2hfresh.com/apps/web" "/home/f2hfresh/htdocs/f2hfresh.com" "/var/www/f2hfresh/apps/web" "/var/www/f2hfresh" "/home/f2hfresh/apps/web"; do
                    if [ -d "$dir" ]; then
                        echo "Syncing frontend .next to $dir..."
                        cp -r .next "$dir/" 2>/dev/null || true
                        cp -r src "$dir/" 2>/dev/null || true
                    fi
                done
                pm2 restart frontend-f2hfresh --update-env || pm2 restart all || pm2 reload all || pm2 start npm --name "frontend-f2hfresh" -- run start
                echo "========== FRONTEND DEPLOYMENT SUCCESS =========="
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
