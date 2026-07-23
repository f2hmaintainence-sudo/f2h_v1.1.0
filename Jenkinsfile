pipeline {
    agent any

    stages {
        stage('Deploy Backend') {
            when {
                changeset "apps/api/**"
            }
            steps {
                sh '''
                echo "========== STARTING BACKEND DEPLOYMENT =========="
                cd apps/api
                npm install --no-audit --no-fund
                npm run build
                pm2 restart api-f2hfresh
                echo "========== BACKEND DEPLOYMENT SUCCESS =========="
                '''
            }
        }

        stage('Deploy Frontend') {
            when {
                changeset "apps/web/**"
            }
            steps {
                sh '''
                echo "========== STARTING FRONTEND DEPLOYMENT =========="
                cd apps/web
                npm install --no-audit --no-fund
                npm run build
                pm2 restart frontend-f2hfresh
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
