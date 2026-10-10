// The generated android/gradle.properties caps the Gradle JVM at -Xmx2g / 512 MB Metaspace, which a *release* build of
// this app (Hermes, ~30 native modules, KSP, lint) exceeds: "OutOfMemoryError: Metaspace". Debug builds squeak by.
// Re-applied on every `expo prebuild`, so the larger limit is not lost with the generated android/ folder.
const { withGradleProperties } = require('expo/config-plugins')

const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1536m -XX:+HeapDumpOnOutOfMemoryError'

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults
    const existing = props.find((p) => p.type === 'property' && p.key === 'org.gradle.jvmargs')
    if (existing) existing.value = JVM_ARGS
    else props.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS })
    return cfg
  })
}
