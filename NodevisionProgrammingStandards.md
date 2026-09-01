<!--Nodevision/NodevisionProgrammingStandards.md -->
<!--This file explains Nodevision's coding standards and practices.-->

# Nodevision Standards and Programming Practices
## By: Henry David Holben
### https://hholben.github.io/

### Introduction
Nodevision is an open-source editor application designed with journaling, notetaking, web coding, and graph visualizations of directory structures in mind. Nodevision was initiated to support HTML-based journaling and notetaking activities, to protect its users' data, and to automatically generate mind-map-like graphs of its users' work. This software takes an HTML-First approach to support users who want to create personal, private websites as journals.

This document provides guiding principles and standards for the development of this project to ensure consistent practices across the codebase and to ensure that new developments conform to Nodevision's goals. This document is subject to change, but is only to be updated in the official repository by Henry Holben, the lead designer and maintainer of the Nodevision project.

### Mission Statement
The Nodevision project seeks to facilitate and encoruage human creativity and curiosity by providing an editing and study environment condusive to creative focus, scientific inquiry, and memory retention.

### Problem Statement
To create and study more efficiently, polymaths need a digital note taking and web development platform that is free and open-source, includes a code editing environment as well as a What You See Is What You Get (WYSIWYG) editing environment as well as both a tree-based hierarchical and a graphical-relational file control system. The platform should support various media types including images, videos, sheet music, diagrams, recordings, mathematical plots, equations, and chemical diagrams.

## Design Philosophy
The following are the principles of Nodevision's design.

1. Free and Open Source
2. Protection of User Privacy
3. HTML/PHP-First
4. Offline Usability
5. Collaboration and Sharing Optional
6. Modular Codebase
7. Independently Deployable Notebooks
8. Linux-First Development
9. Files as Nodes, Links as Edges
10. Files as Worlds
11. Customizable Workspaces
12. Flexibile and Layered Content Dependency System

#### Principle 1. Free and Open Source
Nodevision is available for free under the MIT License. This software is to be used at the user's own risk. No formal agreement or obligation is to exist between the users and developers of this project. Each Nodevision user ought to be considered the full and rightful owner of his or her copy of Nodevision, free to modify, distribute, delete, or sell this copy. As such, the codebase must only include or utilize free and open-source dependencies that grant the same level of autonomy in their usage as Nodevision itself. No portion of Nodevision's native source code is to be obfuscated. The architecture and entire codebase of the system are to be transparent.

#### Principle 2. Protection of User Privacy
Being, in part, a journaling application, Nodevision must prioritize users' privacy. Users of Nodevision ought to be considered to be the sole owners of their notebooks. While the app should be configured to allow sharing, deployment, and exporting at the user's own discretion (see Principle 5), protection of the user's Notebook from unwanted viewers is of paramount importance. The software should never collect or share information about the user or the user's computer to any external system without the user's explicit permission.

#### Principle 3. HTML/PHP-first
While many similar applications define a program-specific project file for use by that specific application, Nodevision instead is designed to treat HTML and PHP files as its main project file types. While Nodevision does include dedicated editing environments for many different file types, all supported file types should be importable and renderable inside of HTML web pages or PHP scripts.

#### Principle 4. Local and Offline Functionality
While Nodevision may offer support for including, viewing, or connecting to external resources, its core use case: as an editor and local file viewer should be functional with no network connection.

#### Principle 5. Collaboration Optional
The user of Nodevision should be able to allow other Nodevision users to visit or edit the user's notebooks.

#### Principle 6. Modular Codebase
Nodevision's design must be modular, readable, and easy to modify. Modules should be shared between similar features. Graphical Editors and Viewer panels especially should rely upon shared functions and behaviors  to provide consistent user experience across different editors.

#### Principle 7. Independently Deployable Notebooks
A user's notebook should never be dependent on Nodevision-specific constructions to be deployed on other server platforms. In short, if a user develops a website as a Nodevision notebook and then chooses to upload their website to the public internet as a static website there should be no dependencies upon Nodevision itself.

Likewise, a PHP script written in Nodevision should be immediately deployable on a standard PHP web server. Nodevision itself adds nothing new for other systems to import. Its purpose is to help users configure technology that already exists.

One close exception to this rule is the Nodevision Virtual World Feature, which allows users to construct virtual worlds by embedding Universal Scene Description (USD)-like JSON inside HTML pages. While these constructions do not prevent web pages from being rendered without Nodevision, the worlds themselves require Nodevision or compatible software to be rendered.

#### Principle 8. Linux-First Development
While releases on other operating systems are planned, Nodevision is to be designed for and tested on Linux first. Any feature of Nodevision that does not work on Linux does not deserve to work anywhere else.

#### Principle 9. Files as Nodes, Links as Edges
Nodevision contains an alternative to its built-in file manager called the Graph Manager. This panel creates a graph of the files and folders within the Nodevision/Notebook directory. In this model, individual files are conceptualized as nodes, links such as hyperlinks or source (src)links, or other references such as get and post requests are diagrammed as edges between the nodes in the graph. Directories are conceptualized as compound nodes: parent nodes that may be expanded to show their child nodes or collapsed to simplify the graph for the viewer. When collapsed, directories are used within the graph as the source of the links from and teh destination of links its child nodes. When expanded, directories are the sources and destinations of zero links.

Two kinds of nodes are known: internal and external. In this context, an external node is a file that exiss outside of the Nodevision/Notebook directory. It can include files on the public internet. Technically, a third kind of node, called a "Placeholder Node" is used to render broken edges- that is edges that link to files within the Notebook folder that do not exist.

The graph manager allows for the instant rendering of concept maps or mind maps generated from the structure of the user's Notebook. The creation of a mind map using this feature can set up a more detailed Notebook or vice-versa.

This graph manager also allows users to more easily conceptualize and understand their projects as graphs- allowing for quick visual checks that all needed file links are present, or quick references to file dependencies. It also allows users to prototype quickly. A software application that is drawn with the app's graph as a finite state machine, for example, will necesarily set up the files and strucctures described in that finite state machine.

The default view of the graph manager is the expanded root Notebook directory with all of its child directories collapsed.

#### Principle 10. Files as Worlds
Nodevision includes a built in video gaming feature called its "Game World Viewer / editor" and sometimes referred to as "Nodevision Meta Worlds". This feature allows users to embed 2D or 3D scenese within the HTML or PHP documents in their notebooks.

It follows from Nodevision's "Files-as Nodes" philosophy.

Nodevision Game Worlds are defined using a single Javascript variable defining a Universal Scene Description (USD)-styled syntax.

#### Principle 11. Customizable Workspaces
Nodevision should allow each user to configure the workspace around the activity the user is performing. The user should be able to save the current arrangement of panels, editors, viewers, toolbars, graph views, file views, and other workspace elements as a named layout for future use. These saved workspaces should be treated as user-owned settings rather than Notebook content, should be restorable whenever the user begins the same activity again, and should not reduce the independent deployability of the Notebook itself. The layout system should preserve user privacy, work offline, and remain transparent and editable enough that users can understand and repair their own saved configurations.

#### Principle 12. Flexibile and Layered Content Dependency System
Nodevision should use two distinct models for dependency inclusion. The Nodevision Application system depends on many third party dependncies, which should be installed inside the ApplicationSystem directory in such places as Nodevision/node_modules. These should apply to dependencies that are required for the user's installed Nodevision modules to function correctly. 

However, there is a need for a second set of dependencies, useful only to the user's personal use case. Examples of these include fonts, circuit libraries, aviation sectional maps, dictionaries and spelling/definition check references, materials, 3D models,etc. A user's selection of these to function with or in or on a user's Notebook is specific to each user. Therefore the user should have autonomy over where these dependencies are to be installed. The user should have the option to A. install such third party dependencies in a Nodevision/ServerSettings/NotebookDependencies directory, where the dependencies will stay out of the user's way; or B. Install the dependencies inside the user's own Notebook directory, where the user may see and work with the dependencies as a part of their Notebook's own structure. Users furthermore be able to layer dependencies on top of eachother- overriding, or adding to objects. One example of this is dictionary definitions, which the user should be able to rewrite or add to by identifying one file as having priority over another file of the same definitions.

### Application System Structure
The Nodevision root directory contains the following directories:
1. ApplicationSystem: This contains the main code base that powers the application.
2. Notebook: This directory contains files and directories the user may edit while using the application. All files within this directory are to be edited by the user.
3. UserData: this directory contains private information about the user
4. UserSettings: This directory contains settings specific to the user but not the server itself. This information is generally safe to share with external Nodevision servers the user chooses to visit (however, the user must still opt to share this data before it may be transferred). It includes items such the user's preferences in control mappings, layouts, icons, avatars, and application color schemes.

5. ServerData: This directory contains logs, backups, and graph visualization data. Files in this directory are generated by the ApplicationSystem in response to the user's direction.

6. ServerSettings
This folder contains private information and settings regarding the Nodevision server. These settings and data are to be kept hidden from all users without admin status.

### File Commenting Conventions

All Nodevision files under the ApplicationSystem directory (with exception to file types that do not support comments), excluding files of third-party dependencies, must begin with or have at the earliest lines where they may be inserted without disrupting syntax:

The first of these lines is to contain the file path beginning with Nodevision as the root.

The second line of each native application system file (with the exception of file types that do not support comments) is to contain a college-level paragraph description of the file and its purpose. This description can be multiple sentences but it must be written in full, complete sentences with a subject and a predicate. All sentences in these paragraphs must begin with a capital letter and end in a period. These lengthy explanations are to be contained entirely on the second line of the file without any text being split between lines for readability.

Each applicable, native Nodevision application system file should make use of frequent, descriptive comments to divide each file into readable sections.

### File length
Every native Nodevision application system file (with the exception of .json, .yaml, and .csv files) should be kept at fewer than 200 non-blank, non-comment lines. Files exceeding this length should be broken into reusable, shared modules (see design principle 6).


## Aesthetics Standards

### Introduction
Aesthetics including colors, text size, fonts, and panel dimensions are to be completely customizable by the user. Additionally, users should be able to replace the default button icons, sounds effects, and music with any set of their own. The system will retain a set of default styles and icons that the user may revert to at any time. As such, a clear styles philosophy should be established.

### Color Scheme
The following colors will be used across the system:

Chalkboard Green:
Sepia: #704214;
Ivory:
Charcoal:   #333;
Royal Blue:
Orange:














