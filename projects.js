"use strict"
var fs = require('fs')
var pth = require('path')
var util = require('davidhq-util').util

var GitHub = require("./providers/github")
let github = new GitHub()

class Projects {

  scan(path) {
    return util.scanDirSync(path)
      .filter(dir => this.valid(dir))
      .map(dir => this.info(dir))
  }

  valid(path) {
    return util.fileExists(`${path}/package.json`)
  }

  // returns the info for one project
  info(path) {
    if (this.valid(path)) {
      let pkg = JSON.parse(fs.readFileSync(`${path}/package.json`))

      return {
        name: pkg.name,
        folder: pth.basename(path),
        version: pkg.version,
        path: path,
        dependencies: pkg.dependencies
      }
    }
  }

  depList(project) {
    return project.dependencies ? Object.keys(project.dependencies) : []
  }

  hasDep(project, term) {
    return project.dependencies && this.findDeps(project, term).length > 0
  }

  findDeps(project, term) {
    return util.listSearch(this.depList(project), term)
  }

  // scans all the dependencies for the project and reads the package.json of each one
  depsWithInfo(project) {
    return this.depList(project).map(dep => {
      let pkgFile = `${project.path}/node_modules/${dep}/package.json`
      if(util.fileExists(pkgFile)) {
        let pkg = JSON.parse(fs.readFileSync(pkgFile))

        let obj = {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          homepage: pkg.homepage,
          author: pkg.author, // email, name, url
          npmuser: pkg._npmUser // email, name, url
        }

        if(pkg['repository']) {
          let repo = github.repoName(pkg['repository']['url'])
          obj.github = `https://github.com/${repo}`
        } else {
          obj.github = "<missing>"
        }

        return obj
      } else {
        return {
          missing: true,
          name: dep,
          description: "<missing>",
          github: "<missing>",
          homepage: "<missing>"
        }
      }
    })
  }

  // get all unique dependencies across all projects
  // if some project doesn't have node_modules currently but another one has, then dependency info is still gathered from where it can be
  // each dependency has to be present only once across all scanned projects
  depsWithInfoPath(path) {
    return this.scan(path).reduce((deps, project) => deps.concat(this.depsWithInfo(project).filter(dep => {
      let match = deps.find(d => d.name == dep.name)
      return !match || match.missing
    })), []).filter(dep => !dep.missing)
  }

  depInfo(dep, callback) {
    npmjs.info(dep, (info) => {
      github.repoInfo('visionmedia/superagent', (repo) => {
        info.homepage = repo.homepage
        callback(info)
      })
    })
  }
}

module.exports = Projects
