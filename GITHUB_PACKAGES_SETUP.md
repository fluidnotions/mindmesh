# GitHub Packages Setup Guide

Complete guide to set up private npm packages on your GitHub account.

## Step 1: Create a GitHub Personal Access Token (PAT)

### 1.1 Navigate to Token Settings

1. Go to GitHub.com and sign in
2. Click your profile picture (top right) → **Settings**
3. Scroll down in left sidebar → **Developer settings**
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**

### 1.2 Configure Token

**Name**: `npm-packages` (or any descriptive name)

**Expiration**: Choose based on your needs
- 30 days (recommended for security)
- 90 days
- No expiration (not recommended)

**Select scopes** (checkboxes):
- ✅ **write:packages** - Upload packages to GitHub Package Registry
- ✅ **read:packages** - Download packages from GitHub Package Registry
- ✅ **delete:packages** - Delete packages from GitHub Package Registry (optional)
- ✅ **repo** - (Only if your repository is private)

### 1.3 Generate and Copy Token

1. Click **Generate token** at bottom
2. **COPY THE TOKEN IMMEDIATELY** - you won't see it again!
3. Save it somewhere secure (password manager recommended)

Token will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Update package.json

Open `package.json` and replace `@fluidnotions` with **your actual GitHub username**:

```json
{
  "name": "@fluidnotions/mindmesh",
  "repository": {
    "type": "git",
    "url": "https://github.com/fluidnotions/mindmesh.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

**Important**:
- The package name MUST be scoped with `@fluidnotions/`
- Username is case-sensitive
- Example: If your GitHub username is `JohnDoe`, use `@JohnDoe/mindmesh`

## Step 3: Configure npm Locally

You need to tell npm to use GitHub Packages for your scoped packages.

### Option A: Manual Configuration (Recommended for development)

Create or edit `~/.npmrc` (your home directory):

```bash
# On Linux/Mac
echo "@fluidnotions:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN" >> ~/.npmrc

# Or edit manually
nano ~/.npmrc
# Or
vim ~/.npmrc
```

Add these lines (replace with your actual values):

```
@fluidnotions:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

### Option B: Project-specific .npmrc (For CI/CD)

Create `.npmrc` in your project directory:

```
@fluidnotions:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**⚠️ IMPORTANT**: If using project `.npmrc`, add it to `.gitignore`!

```bash
echo ".npmrc" >> .gitignore
```

## Step 4: Initialize Git Repository on GitHub

If you haven't already:

1. Go to GitHub.com
2. Click **+** (top right) → **New repository**
3. Name: `mindmesh` (or your chosen name)
4. Choose **Private** for private packages
5. Click **Create repository**

Then connect your local repo:

```bash
# If not already initialized
git init
git add -A
git commit -m "Initial commit"

# Add GitHub remote
git remote add origin https://github.com/fluidnotions/mindmesh.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 5: Publish Your First Package

### 5.1 Test the Build

```bash
# Build the library
npm run build:lib

# Check the dist/ folder
ls -la dist/
```

You should see:
- `mindmesh.es.js`
- `mindmesh.umd.js`
- `mindmesh.css`
- `index.d.ts`

### 5.2 Publish

```bash
# First time publish
npm publish

# If you get errors, try:
npm publish --access restricted  # For private packages
```

You'll see output like:
```
npm notice Publishing to https://npm.pkg.github.com
+ @fluidnotions/mindmesh@1.0.0
```

### 5.3 Verify Publication

Go to your GitHub profile:
- Click **Packages** tab
- You should see `mindmesh` listed!

Or check via command line:
```bash
npm view @fluidnotions/mindmesh
```

## Step 6: Install in Another Project

### 6.1 Configure the Consuming Project

In the project where you want to USE the package:

```bash
# Create/edit .npmrc in that project
echo "@fluidnotions:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_PERSONAL_ACCESS_TOKEN" >> .npmrc
```

### 6.2 Install the Package

```bash
npm install @fluidnotions/mindmesh
```

### 6.3 Use It

```typescript
import { App, AppProvider } from '@fluidnotions/mindmesh';
import '@fluidnotions/mindmesh/css';

function MyApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
```

## Step 7: Set Up GitHub Actions (Optional but Recommended)

The workflow is already created at `.github/workflows/publish.yml`.

### 7.1 Enable GitHub Actions

1. Go to your repo on GitHub
2. Click **Settings** tab
3. Click **Actions** → **General** (left sidebar)
4. Under "Workflow permissions", select:
   - ✅ **Read and write permissions**
5. Click **Save**

### 7.2 Publish via Release

Now you can publish by creating a GitHub Release:

```bash
# Tag and push
git tag v1.0.0
git push origin v1.0.0

# Or create release via GitHub CLI
gh release create v1.0.0 --title "Release 1.0.0" --notes "Initial release"
```

GitHub Actions will automatically build and publish!

### 7.3 Manual Trigger

1. Go to **Actions** tab on GitHub
2. Click **Publish to GitHub Packages** workflow
3. Click **Run workflow**
4. Click **Run workflow** button

## Package Visibility Settings

### Make Package Public (Optional)

By default, packages are private. To make public:

1. Go to GitHub.com
2. Click your profile → **Packages**
3. Click your package name
4. Click **Package settings** (right sidebar)
5. Scroll to **Danger Zone**
6. Click **Change visibility** → **Public**

**Note**: Once public, the package can be installed without authentication!

## Troubleshooting

### Error: "npm ERR! 404 Not Found"

**Cause**: Package name doesn't match username or registry not configured

**Fix**:
```bash
# Check your package name
cat package.json | grep name

# Check your registry config
cat ~/.npmrc | grep registry
```

### Error: "npm ERR! 401 Unauthorized"

**Cause**: Token is invalid or missing

**Fix**:
1. Generate new token
2. Update `~/.npmrc` with new token
3. Make sure token has `write:packages` scope

### Error: "npm ERR! 403 Forbidden"

**Cause**:
- Package name already exists
- You don't have permission to publish

**Fix**:
- Use a different package name
- Verify you're authenticated correctly

### "npm ERR! need auth"

**Cause**: Not authenticated

**Fix**:
```bash
npm login --registry=https://npm.pkg.github.com
# Username: fluidnotions
# Password: YOUR_PERSONAL_ACCESS_TOKEN
# Email: your@email.com
```

## Security Best Practices

1. **Never commit tokens to git**
   ```bash
   # Add to .gitignore
   echo ".npmrc" >> .gitignore
   ```

2. **Use environment variables in CI/CD**
   ```bash
   # In GitHub Actions, use:
   # ${{ secrets.GITHUB_TOKEN }}
   ```

3. **Rotate tokens regularly**
   - Create new token every 30-90 days
   - Delete old tokens

4. **Use fine-grained tokens (when available)**
   - Go to Settings → Developer settings → Fine-grained tokens
   - More secure with repository-specific access

## Quick Reference Commands

```bash
# Publish new version
npm version patch  # 1.0.0 → 1.0.1
npm run build:lib
npm publish

# View package info
npm view @YOUR_USERNAME/mindmesh

# List all versions
npm view @YOUR_USERNAME/mindmesh versions

# Install in another project
npm install @YOUR_USERNAME/mindmesh

# Unpublish specific version (within 72 hours)
npm unpublish @YOUR_USERNAME/mindmesh@1.0.0

# Delete entire package
npm unpublish @YOUR_USERNAME/mindmesh --force
```

## Next Steps

1. ✅ Create Personal Access Token
2. ✅ Update package.json with your username
3. ✅ Configure ~/.npmrc with token
4. ✅ Push code to GitHub
5. ✅ Run `npm run build:lib`
6. ✅ Run `npm publish`
7. ✅ Verify on GitHub Packages page
8. ✅ Install in another project to test

## Support Links

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [npm-publish GitHub Action](https://github.com/marketplace/actions/npm-publish)
- [Working with npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

---

**You're now ready to publish private npm packages on GitHub! 🎉**
