const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AIInstructionLogger {
    constructor() {
        this.baseLogPath = path.join(__dirname, '../../docs/logs');
    }

    /**
     * ユーザーIDをハッシュ化
     * @param {string} userId - ユーザーID
     * @returns {string} ハッシュ化されたユーザーID
     */
    hashUserId(userId) {
        return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 12);
    }

    /**
     * ログファイル名を生成
     * @param {string} category - カテゴリ
     * @returns {string} ログファイル名
     */
    generateLogFileName(category) {
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_')
            .replace(/:/g, '-')
            .replace(/\..+/, '');
        return `${timestamp}_${category}.log`;
    }

    /**
     * カテゴリを判定
     * @param {string} instruction - AI指示内容
     * @returns {string} カテゴリ
     */
    determineCategory(instruction) {
        const lowerInstruction = instruction.toLowerCase();
        
        if (lowerInstruction.includes('code') || 
            lowerInstruction.includes('実装') || 
            lowerInstruction.includes('function') ||
            lowerInstruction.includes('プログラム')) {
            return 'code';
        } else if (lowerInstruction.includes('document') || 
                   lowerInstruction.includes('ドキュメント') || 
                   lowerInstruction.includes('readme') ||
                   lowerInstruction.includes('説明')) {
            return 'documentation';
        } else if (lowerInstruction.includes('community') || 
                   lowerInstruction.includes('コミュニティ') || 
                   lowerInstruction.includes('help') ||
                   lowerInstruction.includes('support')) {
            return 'community';
        } else if (lowerInstruction.includes('issue') || 
                   lowerInstruction.includes('bug') || 
                   lowerInstruction.includes('problem') ||
                   lowerInstruction.includes('エラー')) {
            return 'issue';
        }
        
        return 'code'; // デフォルト
    }

    /**
     * スコアを計算
     * @param {string} category - カテゴリ
     * @param {number} baseScore - 基本スコア
     * @returns {object} スコア情報
     */
    calculateScore(category, baseScore = 100) {
        const weights = {
            'code': 1.0,
            'documentation': 0.8,
            'community': 0.6,
            'issue': 0.4
        };
        
        const weight = weights[category] || 1.0;
        const finalScore = baseScore * weight;
        
        return {
            baseScore,
            weight,
            finalScore
        };
    }

    /**
     * センシティブな情報を除去
     * @param {string} text - テキスト
     * @returns {string} クリーンなテキスト
     */
    sanitizeContent(text) {
        // APIキー、トークン、パスワードなどのパターンを除去
        const patterns = [
            /api[_-]?key[\s]*[:=][\s]*["']?[\w-]+["']?/gi,
            /token[\s]*[:=][\s]*["']?[\w-]+["']?/gi,
            /password[\s]*[:=][\s]*["']?[\w-]+["']?/gi,
            /secret[\s]*[:=][\s]*["']?[\w-]+["']?/gi,
            /private[_-]?key[\s]*[:=][\s]*["']?[\w-]+["']?/gi,
        ];
        
        let sanitized = text;
        patterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        });
        
        return sanitized;
    }

    /**
     * AIへの指示とレスポンスをログに記録
     * @param {object} params - ログパラメータ
     * @param {string} params.userId - ユーザーID
     * @param {string} params.instruction - AI指示内容
     * @param {string} params.response - AIレスポンス
     * @param {string} params.category - カテゴリ（オプション）
     * @param {number} params.baseScore - 基本スコア（オプション）
     * @param {string} params.notes - 追加メモ（オプション）
     * @returns {Promise<string>} ログファイルパス
     */
    async logInstruction({
        userId,
        instruction,
        response,
        category = null,
        baseScore = 100,
        notes = ''
    }) {
        try {
            // カテゴリを決定
            const finalCategory = category || this.determineCategory(instruction);
            
            // ユーザーIDをハッシュ化
            const hashedUserId = this.hashUserId(userId);
            
            // センシティブな情報を除去
            const sanitizedInstruction = this.sanitizeContent(instruction);
            const sanitizedResponse = this.sanitizeContent(response);
            
            // スコアを計算
            const score = this.calculateScore(finalCategory, baseScore);
            
            // ログ内容を作成
            const logContent = `# AI Instruction Log

**Date**: ${new Date().toISOString().replace('T', ' ').split('.')[0]}
**Category**: ${finalCategory}
**User**: ${hashedUserId}

## Instruction
${sanitizedInstruction}

## Response
${sanitizedResponse}

## Evaluation
- **Contribution Type**: ${this.getCategoryDisplayName(finalCategory)}
- **Base Score**: ${score.baseScore}
- **Weight Applied**: ${score.weight}
- **Final Score**: ${score.finalScore}

## Notes
${notes || 'No additional notes.'}
`;

            // ログファイルパスを生成
            const logFileName = this.generateLogFileName(finalCategory);
            const logFilePath = path.join(this.baseLogPath, finalCategory, logFileName);
            
            // ディレクトリが存在することを確認
            await fs.mkdir(path.dirname(logFilePath), { recursive: true });
            
            // ログファイルを書き込み
            await fs.writeFile(logFilePath, logContent, 'utf8');
            
            console.log(`AI instruction logged: ${logFilePath}`);
            return logFilePath;
            
        } catch (error) {
            console.error('Error logging AI instruction:', error);
            throw error;
        }
    }

    /**
     * カテゴリの表示名を取得
     * @param {string} category - カテゴリ
     * @returns {string} 表示名
     */
    getCategoryDisplayName(category) {
        const displayNames = {
            'code': 'Code Contribution',
            'documentation': 'Documentation Enhancement',
            'community': 'Community Support',
            'issue': 'Issue Management'
        };
        return displayNames[category] || 'General Contribution';
    }

    /**
     * 指定期間のログを取得
     * @param {Date} startDate - 開始日
     * @param {Date} endDate - 終了日
     * @param {string} category - カテゴリ（オプション）
     * @returns {Promise<Array>} ログファイルのリスト
     */
    async getLogsInPeriod(startDate, endDate, category = null) {
        const logs = [];
        const categories = category ? [category] : ['code', 'documentation', 'community', 'issue'];
        
        for (const cat of categories) {
            const categoryPath = path.join(this.baseLogPath, cat);
            try {
                const files = await fs.readdir(categoryPath);
                
                for (const file of files) {
                    if (file.endsWith('.log')) {
                        const filePath = path.join(categoryPath, file);
                        const stats = await fs.stat(filePath);
                        
                        if (stats.mtime >= startDate && stats.mtime <= endDate) {
                            logs.push({
                                path: filePath,
                                category: cat,
                                modified: stats.mtime,
                                size: stats.size
                            });
                        }
                    }
                }
            } catch (error) {
                // ディレクトリが存在しない場合は無視
                if (error.code !== 'ENOENT') {
                    console.error(`Error reading logs in ${cat}:`, error);
                }
            }
        }
        
        return logs.sort((a, b) => b.modified - a.modified);
    }

    /**
     * スレッドが既に評価されているかログから確認
     * @param {string} threadId - スレッドID
     * @returns {Promise<boolean>} 評価済みの場合true
     */
    async isThreadEvaluatedInLogs(threadId) {
        try {
            const categories = ['code', 'documentation', 'community', 'issue'];
            
            for (const category of categories) {
                const categoryPath = path.join(this.baseLogPath, category);
                
                try {
                    const files = await fs.readdir(categoryPath);
                    
                    for (const file of files) {
                        if (file.endsWith('.log')) {
                            const filePath = path.join(categoryPath, file);
                            const content = await fs.readFile(filePath, 'utf8');
                            
                            // Check if the log contains this thread ID
                            if (content.includes(`Thread evaluation for channel:`) && 
                                content.includes(threadId)) {
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.error(`Error checking logs in ${category}:`, error);
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking thread evaluation status:', error);
            return false;
        }
    }
}

module.exports = new AIInstructionLogger();