import {runProcess} from '../process-runner.mjs';
import {normalizeStandardVersionReport} from '../version-report.mjs';

export function calculateStandardVersion(context,{run=runProcess}={}){
  const result=run({command:context.adapterBin,
    args:['--dry-run','--skip.commit','--skip.tag','--tag-prefix',context.tagPrefix??'v'],
    cwd:context.projectDirectory,workspace:context.workspace,env:context.env});
  return normalizeStandardVersionReport({nativeOutput:result.stdout+result.stderr,branch:context.targetBranch,
    sha:context.sha,repository:context.projectDirectory,tagPrefix:context.tagPrefix??'v'});
}
