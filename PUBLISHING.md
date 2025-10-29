# Publishing to GitHub Packages

This guide explains how to publish the ObClone library to GitHub Packages (private npm registry).

## Prerequisites

1. GitHub account with package publishing permissions
2. GitHub Personal Access Token with `write:packages` scope
3. Repository configured on GitHub

## One-Time Setup

### 1. Update Package Name

In `package.json`, replace `@your-username` with your GitHub username:

```json
{
  "name": "@YOUR_GITHUB_USERNAME/obclone",
  "repository": {
    "url": "https://github.com/YOUR_GITHUB_USERNAME/obclone.git"
  }
}
```

### 2. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `write:packages` (to publish)
   - `read:packages` (to install)
   - `repo` (if repository is private)
4. Generate and copy the token

### 3. Configure Local npm

Create/edit `~/.npmrc`:

```bash
@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

## Manual Publishing

### Build and Publish

```bash
# 1. Update version (choose one)
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# 2. Build library
npm run build:lib

# 3. Publish to GitHub Packages
npm publish
```

### Verify Publication

```bash
# List published versions
npm view @YOUR_GITHUB_USERNAME/obclone versions

# View package info
npm view @YOUR_GITHUB_USERNAME/obclone
```

## Automated Publishing with GitHub Actions

The repository includes a GitHub Actions workflow for automated publishing.

### Publish via Release

1. Create a new release on GitHub
2. The workflow automatically builds and publishes
3. Uses the version from `package.json`

```bash
# Command line release creation
gh release create v1.0.0 --title "Release 1.0.0" --notes "Initial release"
```

### Manual Workflow Trigger

1. Go to Actions tab on GitHub
2. Select "Publish to GitHub Packages"
3. Click "Run workflow"
4. Optionally specify a version

## Installing the Published Package

### In Your Project

```bash
# Configure npm for GitHub Packages
echo "@YOUR_GITHUB_USERNAME:registry=https://npm.pkg.github.com" >> .npmrc

# Add authentication (use environment variable in CI/CD)
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# Install
npm install @YOUR_GITHUB_USERNAME/obclone
```

### In CI/CD (GitHub Actions)

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      registry-url: 'https://npm.pkg.github.com'
      scope: '@YOUR_GITHUB_USERNAME'

  - name: Install dependencies
    run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Package Visibility

### Private Package (Default)

- Only visible to you and collaborators
- Requires authentication to install
- Recommended for proprietary code

### Public Package

To make the package public:

1. Go to package settings on GitHub
2. Change visibility to Public
3. Anyone can install without authentication

## Version Management

### Semantic Versioning

Follow [semver](https://semver.org/):

- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features, backward compatible
- **PATCH** (x.x.1): Bug fixes

### Pre-release Versions

```bash
# Alpha release
npm version prerelease --preid=alpha  # 1.0.0-alpha.0

# Beta release
npm version prerelease --preid=beta   # 1.0.0-beta.0

# Release candidate
npm version prerelease --preid=rc     # 1.0.0-rc.0
```

## Troubleshooting

### Authentication Failed

```bash
# Verify token has correct permissions
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user/packages

# Re-authenticate
npm logout
npm login --registry=https://npm.pkg.github.com
```

### Package Not Found

```bash
# Verify package name matches GitHub username
npm view @YOUR_GITHUB_USERNAME/obclone

# Check registry configuration
npm config get @YOUR_GITHUB_USERNAME:registry
```

### Build Failures

```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build:lib

# Check TypeScript errors
npm run build:lib 2>&1 | grep "error TS"
```

## Best Practices

1. **Always run tests before publishing**
   ```bash
   npm run test:run && npm run build:lib && npm publish
   ```

2. **Use prepublishOnly script** (already configured)
   - Automatically runs tests and builds before publish

3. **Tag releases**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Maintain CHANGELOG.md**
   - Document all changes between versions

5. **Semantic versioning**
   - Never republish the same version
   - Use pre-release versions for testing

## Package Contents

The published package includes:

```
dist/
  obclone.es.js       # ESM bundle
  obclone.umd.js      # UMD bundle
  obclone.css         # Styles
  index.d.ts          # TypeScript definitions
  *.d.ts              # Additional type files
README.md
LICENSE
package.json
```

## Security

- **Never commit `.npmrc` with tokens** to git
- Use environment variables in CI/CD
- Rotate tokens periodically
- Use fine-grained tokens when possible

## Support

For issues:
- Check GitHub Actions logs
- Verify package.json configuration
- Ensure all dependencies are listed correctly
- Test locally with `npm link` before publishing
