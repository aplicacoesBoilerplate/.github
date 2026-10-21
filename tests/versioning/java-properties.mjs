import assert from 'node:assert/strict';
import { parseJavaProperties } from '../../scripts/versioning/java-properties.mjs';
import { parseJavaProperties as parseTypedProperties } from '../../scripts/versioning/dist/adapters/java-properties.js';
assert.deepEqual(parseJavaProperties('# native export\n! comment\njgitver.used_version=0.0.1\njgitver.git_sha1_full : abc\nescaped\\ key=hello\\u0020world\ncontinued=line\\\n  two\nspecial=a\\=b\\:c\\tend\n'), {
  'jgitver.used_version':'0.0.1','jgitver.git_sha1_full':'abc','escaped key':'hello world',
  continued:'linetwo',special:'a=b:c\tend',
});
assert.throws(()=>parseJavaProperties('key=bad\\u12ZZ'),/unicode/);
assert.throws(()=>parseJavaProperties('key=one\nkey=two'),/duplicada/);
assert.throws(()=>parseJavaProperties('key=unfinished\\'),/continuação/);
assert.throws(()=>parseJavaProperties(null),/Properties inválido/);
assert.deepEqual(parseTypedProperties('name=hello\\u0020world\n'),{name:'hello world'});
console.log('Java Properties contract passed');
