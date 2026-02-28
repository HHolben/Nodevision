#include <QApplication>
#include <QMainWindow>
#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QComboBox>
#include <QGroupBox>
#include <QCheckBox>
#include <QLineEdit>
#include <QPushButton>
#include <QProcess>
#include <QDebug>

// Structure to hold UI elements for a sub-server row
struct SubServerRow {
    QCheckBox *checkBox;
    QLineEdit *portEdit;
    QLineEdit *fileEdit;
    QString serverType; // e.g., "node", "deno", etc.
};

class ServerLauncherWindow : public QMainWindow {
    Q_OBJECT

public:
    ServerLauncherWindow(QWidget *parent = nullptr) : QMainWindow(parent) {
        QWidget *centralWidget = new QWidget(this);
        QVBoxLayout *mainLayout = new QVBoxLayout(centralWidget);

        // --- Main Server Section ---
        QLabel *mainLabel = new QLabel("Select Main Server File:", this);
        mainLayout->addWidget(mainLabel);

        mainServerCombo = new QComboBox(this);
        // Populate the combo box with server file options
        mainServerCombo->addItems({"server.js", "server.ts", "server.php", "server.java", "server.cpp"});
        mainLayout->addWidget(mainServerCombo);

        // --- Sub-Server Section ---
        QGroupBox *subServerGroup = new QGroupBox("Sub-Servers", this);
        QVBoxLayout *subLayout = new QVBoxLayout(subServerGroup);

        // For simplicity, we define the same back-end options for sub-servers.
        QStringList subServerTypes = {"node.js", "deno", "php", "java", "cpp"};

        for (const QString &type : subServerTypes) {
            // Create a horizontal layout for each sub-server option
            QHBoxLayout *rowLayout = new QHBoxLayout();

            QCheckBox *cb = new QCheckBox(type, this);
            rowLayout->addWidget(cb);

            // Port input field
            QLineEdit *portEdit = new QLineEdit(this);
            portEdit->setPlaceholderText("Port");
            portEdit->setFixedWidth(60);
            rowLayout->addWidget(portEdit);

            // File location field
            QLineEdit *fileEdit = new QLineEdit(this);
            fileEdit->setPlaceholderText("File location");
            rowLayout->addWidget(fileEdit);

            // Save these controls in our vector for later use
            SubServerRow row = { cb, portEdit, fileEdit, type };
            subServerRows.append(row);

            subLayout->addLayout(rowLayout);
        }
        mainLayout->addWidget(subServerGroup);

        // --- Run Button ---
        QPushButton *runButton = new QPushButton("Start Servers", this);
        connect(runButton, &QPushButton::clicked, this, &ServerLauncherWindow::onRunClicked);
        mainLayout->addWidget(runButton);

        setCentralWidget(centralWidget);
        setWindowTitle("Hybrid Server Launcher");
        resize(600, 300);
    }

private slots:
    void onRunClicked() {
        // Launch the main server
        QString mainServer = mainServerCombo->currentText();
        QString mainCommand;

        // Decide which command to run for the main server (adjust as needed)
        if (mainServer.endsWith(".js"))
            mainCommand = "node " + mainServer;
        else if (mainServer.endsWith(".ts"))
            mainCommand = "deno run " + mainServer;
        else if (mainServer.endsWith(".php"))
            mainCommand = "php " + mainServer;
        else if (mainServer.endsWith(".java"))
            mainCommand = "java " + mainServer;
        else if (mainServer.endsWith(".cpp"))
            mainCommand = "./" + mainServer; // assumes it is compiled
        else
            mainCommand = "";

        if (!mainCommand.isEmpty()) {
            qDebug() << "Starting main server:" << mainCommand;
            // Use startDetached to run the process independently.
            QProcess::startDetached(mainCommand);
        }

        // Launch selected sub-servers
        for (const SubServerRow &row : qAsConst(subServerRows)) {
            if (row.checkBox->isChecked()) {
                QString subCommand;
                QString filePath = row.fileEdit->text();
                QString port = row.portEdit->text();

                // Build command based on server type; you may want to pass the port and file as arguments.
                if (row.serverType == "node.js") {
                    subCommand = "node " + filePath + " " + port;
                } else if (row.serverType == "deno") {
                    subCommand = "deno run " + filePath + " " + port;
                } else if (row.serverType == "php") {
                    subCommand = "php " + filePath + " " + port;
                } else if (row.serverType == "java") {
                    subCommand = "java " + filePath + " " + port;
                } else if (row.serverType == "cpp") {
                    subCommand = "./" + filePath + " " + port;
                }

                if (!subCommand.isEmpty()) {
                    qDebug() << "Starting sub-server:" << subCommand;
                    QProcess::startDetached(subCommand);
                }
            }
        }
    }

private:
    QComboBox *mainServerCombo;
    QList<SubServerRow> subServerRows;
};

#include "main.moc" // Needed for Qt's meta-object system if not using a separate .cpp for slots

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    ServerLauncherWindow window;
    window.show();
    return app.exec();
}
