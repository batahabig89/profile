#!/bin/bash

echo "🚀 Pushing profile page to GitHub..."
echo ""

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Make sure you're in the profile_page directory."
    exit 1
fi

# Check git status
echo "📋 Current git status:"
git status --short
echo ""

# Add all files except README.md
echo "📁 Adding files to git..."
git add index.html styles.css script.js script-server.js profile-data.json server.py
echo "✅ Files added"
echo ""

# Commit changes
echo "💾 Committing changes..."
git commit -m "Update profile page with rocket animation"
echo "✅ Changes committed"
echo ""

# Push to main branch
echo "🚀 Pushing to GitHub..."
echo "You may need to enter your GitHub username and personal access token when prompted."
echo ""

# Try to push
if git push -u origin main; then
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🌐 Your profile page should be available at:"
    echo "   https://batahabig89.github.io/profile/"
    echo ""
    echo "📝 To enable GitHub Pages:"
    echo "   1. Go to https://github.com/batahabig89/profile"
    echo "   2. Click Settings tab"
    echo "   3. Scroll to Pages section"
    echo "   4. Select 'Deploy from a branch'"
    echo "   5. Choose 'main' branch and '/' folder"
    echo "   6. Click Save"
else
    echo "❌ Push failed. You may need to:"
    echo "   1. Create a Personal Access Token at https://github.com/settings/tokens"
    echo "   2. Use: git remote set-url origin https://batahabig89:YOUR_TOKEN@github.com/batahabig89/profile.git"
    echo "   3. Then run this script again"
fi
