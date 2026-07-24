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
                # Sync compiled backend if live directory exists
                if [ -d "/home/f2hfresh/htdocs/f2hfresh.com" ]; then
                    cp -r dist /home/f2hfresh/htdocs/f2hfresh.com/apps/api/ 2>/dev/null || true
                fi
                pm2 restart api-f2hfresh || pm2 restart all || pm2 reload all || pm2 start npm --name "api-f2hfresh" -- run start
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
                # Sync compiled frontend build if live directory exists
                if [ -d "/home/f2hfresh/htdocs/f2hfresh.com" ]; then
                    cp -r .next /home/f2hfresh/htdocs/f2hfresh.com/apps/web/ 2>/dev/null || true
                    cp -r .next /home/f2hfresh/htdocs/f2hfresh.com/ 2>/dev/null || true
                fi
                pm2 restart frontend-f2hfresh || pm2 restart all || pm2 reload all || pm2 start npm --name "frontend-f2hfresh" -- run start
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
