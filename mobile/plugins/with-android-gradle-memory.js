const { withGradleProperties } = require('@expo/config-plugins');

const properties = {
  'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8',
  'org.gradle.parallel': 'false',
  'org.gradle.workers.max': '4',
};

module.exports = function withAndroidGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    for (const [key, value] of Object.entries(properties)) {
      const property = config.modResults.find(
        (entry) => entry.type === 'property' && entry.key === key
      );
      if (property) {
        property.value = value;
      } else {
        config.modResults.push({ type: 'property', key, value });
      }
    }
    return config;
  });
};
