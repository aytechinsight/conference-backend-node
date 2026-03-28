const Article = require('../models/Article');
const path = require('path');
const fs = require('fs');

// @desc Submit a new article
// @route POST /api/articles
// @access Private
exports.submitArticle = async (req, res) => {
    try {
        const { title, correspondingAuthorName, numberOfAuthors, authors, plagiarismDeclared } = req.body;

        // Validation
        if (!title || !correspondingAuthorName || !numberOfAuthors || !authors || !plagiarismDeclared) {
            // Clean up uploaded file if validation fails
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'All fields are required.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a paper file (PDF/DOC/DOCX).' });
        }

        // Parse authors if sent as JSON string
        let parsedAuthors;
        try {
            parsedAuthors = typeof authors === 'string' ? JSON.parse(authors) : authors;
        } catch {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Invalid authors data format.' });
        }

        // Validate each author has name and email
        if (!Array.isArray(parsedAuthors) || parsedAuthors.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Please provide at least one author with name and email.' });
        }

        for (const author of parsedAuthors) {
            if (!author.name || !author.email) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Each author must have a name and email address.' });
            }
        }

        const article = await Article.create({
            title,
            correspondingAuthor: {
                name: correspondingAuthorName,
                email: req.user.email,
            },
            numberOfAuthors: parseInt(numberOfAuthors, 10),
            authors: parsedAuthors,
            paperFile: req.file.path.replace(/\\/g, '/'),
            originalFileName: req.file.originalname,
            plagiarismDeclared: plagiarismDeclared === 'true' || plagiarismDeclared === true,
            submittedBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: 'Article submitted successfully!',
            article: {
                articleId: article.articleId,
                title: article.title,
                status: article.status,
                correspondingAuthor: article.correspondingAuthor,
                numberOfAuthors: article.numberOfAuthors,
                authors: article.authors,
                originalFileName: article.originalFileName,
                createdAt: article.createdAt,
            },
        });
    } catch (error) {
        console.error('Submit article error:', error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        res.status(500).json({ message: 'Server error while submitting article.' });
    }
};

// @desc Get all articles for the logged-in user
// @route GET /api/articles/my
// @access Private
exports.getMyArticles = async (req, res) => {
    try {
        const articles = await Article.find({ submittedBy: req.user._id })
            .sort({ createdAt: -1 })
            .select('-paperFile');

        res.json({ success: true, articles });
    } catch (error) {
        console.error('Get my articles error:', error);
        res.status(500).json({ message: 'Server error while fetching articles.' });
    }
};

// @desc Get single article by articleId
// @route GET /api/articles/:articleId
// @access Private
exports.getArticleById = async (req, res) => {
    try {
        const article = await Article.findOne({
            articleId: req.params.articleId,
            submittedBy: req.user._id,
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found.' });
        }

        res.json({ success: true, article });
    } catch (error) {
        console.error('Get article error:', error);
        res.status(500).json({ message: 'Server error while fetching article.' });
    }
};
