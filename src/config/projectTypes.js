// src/config/projectTypes.js
export const PROJECT_TYPES = {
    youtube: {
      label: 'YouTube',
      description: 'Video content with scripting, filming, and editing',
      subfolders: ['scripts', 'thumbnails', 'clips', 'footage', 'audio', 'exports'],
      defaultTasks: [
        'Write script',
        'Record footage',
        'Edit video',
        'Design thumbnail',
        'Write title & description',
        'Upload & schedule',
      ],
    },
    electronics: {
      label: 'Electronics',
      description: 'Hardware builds, schematics, and prototyping',
      subfolders: ['schematics', 'code', 'research', 'docs', 'renders', 'assets'],
      defaultTasks: [
        'Define requirements',
        'Draft schematic',
        'Order components',
        'Breadboard prototype',
        'Write firmware',
        'Design enclosure',
        'Test & iterate',
      ],
    },
    coding: {
      label: 'Coding',
      description: 'Software projects, scripts, and tooling',
      subfolders: ['code', 'docs', 'research', 'mockups', 'assets', 'notes'],
      defaultTasks: [
        'Scope the project',
        'Set up repo',
        'Build MVP',
        'Write tests',
        'Document',
        'Deploy',
      ],
    },
    blank: {
      label: 'Blank Project',
      description: 'Just a whiteboard and loose file storage — no subfolders.',
      subfolders: [],
      defaultTasks: [],
    },
  }