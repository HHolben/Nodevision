<!--Nodevision/NodevisionProgrammingStandards.md -->
<!--This file explains Nodevision's coding standards and practices.-->

# Nodevision Standards and Programming Practices
## By: Henry David Holben
### https://hholben.github.io/

### Introduction
Nodevision is an open-source editor application designed with journaling, notetaking, web coding, and graph visualizations of directory structures in mind. Nodevision was initiated to support HTML-based journaling and notetaking activities, to protect its users' data, and to automatically generate mind-map-like graphs of its users' work. This software takes an HTML-First approach to support users who want to create personal, private websites as journals.

This document provides guiding principles and standards for the development of this project to ensure consistent practices across the codebase and to ensure that new developments conform to Nodevision's goals. This document is subject to change, but is only to be updated in the official repository by Henry Holben, the lead designer and maintainer of the Nodevision project. 

### Design Philosophy

The following are principles of Nodevision's design.

1. Free and Open Source 
2. Protection of User Privacy
3. HTML/PHP-First
4. Offline Usability
5. Collaboration and Sharing Optional
6. Modular Codebase
7. Independently Deployable Notebooks
8. Linux-First Development

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
















